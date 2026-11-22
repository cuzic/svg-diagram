# Review of PR #451 (ADR 0078 U0a, the content inventory), round 1

PR #451 at a21ae47f, Issue #447 plus its follow-up comment. Files: `lib/inventory.ts` (new), `lib/types/inventory.ts` (new), `lib/emit-common.ts`, `lib/emit-boxes.ts`, `lib/layout.ts`, `lib/types/index.ts`, `test/inventory.test.ts`, README, ADR 0078 text.

Verdict: **Accept with changes. No Blocker; 1 Major (row arrows are missing from the inventory), 8 Minors.** The refactor is byte-identical in every case I tried, the inventory is pure, deterministic and cheap, and all 7 of Codex's mutations are caught. The inventory is right for ordinary text and boxes; it is blind to the arrows between row children, step badges and icons, and the ink rectangle is a little small for some scripts.

## Leak check
Clean. The diff contains neutral sentences only (「要確認」「ここが変更点」, plus 「ここが変更点確認してください」 in a test), no names, paths, session ids or emails. The PR body links only to this repository's own Issue comment and CI run.

## What I checked, and the results

**1. Conformance (Issue #447 T1-T13, 7 mutations, ADR 0078 D1/D3/U0).**
- T1-T13 are all present and pass (25 tests in `test/inventory.test.ts`; `core-purity` and `band-registries` pass; `tsc -p .` exits 0). T11 compares the handler keys with `EMIT_HANDLERS` rather than a `band-registries` list; equivalent, and `INVENTORY_HANDLERS satisfies InventoryHandlers` already makes the table total at compile time.
- The T6/T10 decision is implemented as decided: connector labels record `labelBox`/`chipBox`, with a baseline check against `labelY`; the type comment and the ADR U0 note say so. I confirmed on four label kinds (plain, chip, bracket, callout) that `labelBox` is a conservative rectangle around the text (box top about 2px above the ink top, bottom 4px below the baseline).
- All 7 mutations reproduce as caught: centre-as-left (4 failures), `INK_ASCENT` 0.5 (3), drop the last line (10), ignore indent (1), arrowhead for `none` (2), no `whole` (1), `lineYs[i+1]` (2).
- Deviations from the Issue: (a) "list the band types with non-finite geometry in the table comment" is not done (only `grid` is commented, `lib/inventory.ts:65`); `whole` silently returns `[]` for non-finite rectangles (`:55`) with no test of which types that is (m6). (b) T10 as written checks x only for wrapped text and baseline for connector labels; widths are not checked (m3).

**2. Did `runLineOrigin` leave emit byte-identical? Yes.** I rendered the same inputs in a clean worktree of the PR's base (`aa16a14e`) and in the PR:
- all 194 example sources through `renderSource` (real measurer, SHA-1 of the SVG): 194/194 identical, 0 errors;
- 16 odd inputs through `layoutWith` + `emitSvg`: Arabic and Hebrew titles and wrapped bodies, bidi mixed with CJK, rich text (`**bold**`, `` `mono` ``, `*italic*`, spans in `lines`/`note`), a narrow box with an unbreakable word and right alignment, steps with left/centre/right alignment and wrapped, left icon and top icon, tags/stamps in a row, frameless boxes, `stat()`, banner with sub and stamp, grid in a framed group and a frameless group, captions with role/mono/bold/alignment, emoji with ZWJ and flags, empty strings, labelled/chip/loop-under connectors, reveal/until: 16/16 byte-identical.
The refactor itself is sound: `runLineOrigin` reproduces the old `anchor`/`lx` formula branch for branch; `boxTextPlacement` folds `renderBoxText`'s `defaultAlign` into `band.align ?? (banner || iconAt === 'top' ? 'center' : 'left')`, which equals both old call sites; `stampGeometry` returns exactly the old `snap4` values; `renderBoxText` was exported and is now private, with no other user in `lib/`, `test/`, `scripts/` or the root files.

**3. Do the rectangles match the glyphs in Chromium? Mostly; details below.** I rendered figures with the production pipeline (`renderDiagram`, Chromium measurer), matched every inventory `text` item to its `<text>` element, and compared with `getBBox()` (horizontal) and `measureText().actualBoundingBox*` (vertical ink). I also drew the rectangles over the images (`r451/*-overlay.png` in the scratchpad: pink text rects, blue frames, green badges/arrowheads).
- Matching: `steps` 11/12 items matched (the unmatched one is the connector label, by design), `canvas-swot` 18/18, `why-why` 3/3, custom figures 4/4 to 5/5.
- Ordinary CJK text (steps, canvas-swot): x within 0.28px, width within -0.55..+0.01px, ink top 0.1-0.25px above the rectangle top, ink bottom 1.5-1.75px inside the rectangle bottom.
- Where it deviates (all with the production measurer):
  - **Ink top/bottom (INK_ASCENT 0.85, INK_HEIGHT 1.1):** Latin text with brackets/parentheses pokes above the rectangle by 1.1-1.25px at 14-15px; accents (`Å`, `Ω`, `ǅ`) by 3.25px; Arabic by 2.1px; descenders and `{}|` poke below by 0.25-0.5px. Large "display" text and digits are well inside (the rectangle is 5.6px taller than the ink).
  - **Width:** the inventory width is the layout's atom-sum width, so it is wider than the drawn text where Chromium trims CJK punctuation (`text-spacing-trim`): -7.7px on a 449px line (`矢印は原因 → 結果。「なぜ?」…（下へ）`), -7.5px on `「括弧」（全角）ー〜…`, -97.5px on a pathological run of `（（（（（））））））`; Arabic is 27% too wide (-101px on a 426px line, -33.7px on a short title). It is narrower than the drawn text for emoji sequences (+4.5px for `✅ 😀 👨‍👩‍👧 🇯🇵`, +1.4px for `⭐ ❤️ ✔`). Wider is the safe direction for covering checks; narrower is not.
- Frames and stamps match the drawn rectangles. **Tags do not:** see m1 (up to 2.00px).

**4. Determinism, purity and cost.** `buildInventory` is a pure function of `laidOut`, `connects` and `widthOf` (no clock, no random, no I/O); T13 and my double-run agree; `core-purity` passes; there is no value-import cycle (checked by a script: `inventory.ts` reaches `emit-boxes`/`emit-common`, neither reaches `layout.ts`). Cost: over 190 example figures (20 repetitions each, fixed `widthOf`), layout 837-870 ms in total versus 1.3-1.4 ms for all inventories, i.e. 0.15%; the largest single inventory is 0.077 ms (`icons.ts`, 77 items). `buildInventory` runs once per `layoutBands`, so retries (`fitLineScale`, bunsetsu fallback, fill scaling) multiply it, still negligible. Average 7 items per figure, maximum 95.

**5. My own mutations.** Eight on top of Codex's seven (run against `test/inventory.test.ts`):
| Mutation | Result |
|---|---|
| `HEAD_LENGTH` 12 to 8 | caught (only by the short-leg test) |
| `HEAD_PAD` 4 to 0 | caught (only by the short-leg test) |
| frame uses the raw rectangle (no `snap4`) | caught (T1) |
| group stamp skipped | caught |
| tag rectangle snapped to the grid | caught (the test compares with raw `tagBox`; this encodes the m1 inconsistency) |
| `chipBox`/`labelBox` precedence swapped | **survives** (the two are the same rectangle for chips; equivalent) |
| text width taken from line 0 for every line | **survives** (T3's two lines have equal width) |
| right alignment ignores `indent` in `runLineOrigin` | **survives** (no test pins right alignment with a step badge, and the emit/inventory comparison uses the same function) |
Two real gaps (m4).

## Findings

### Major

**M1. The arrows between row children are not in the inventory, and nothing stands in for them (`lib/inventory.ts:52` `childBoxes`, `:66` `row: childBoxes`; drawn at `lib/emit-boxes.ts:181`; type `LaidOutRow.arrows` in `lib/types/containers.ts:286`).**
`row()` draws `band.arrows` (the arrow between adjacent boxes, and the loop-back arrows) with `arrowMarkers`, but `childBoxes` emits only the children. A `steps` figure therefore has 5 frames and 12 texts but **no arrowhead and no connector for the row's own arrows**; in the overlay picture of `steps` the black arrowheads between the boxes have no rectangle. ADR 0078 D3 classifies an arrowhead as a "関係の端" whose covering is a problem (`overlay-hides-link`); Issue #447 put `connect()` arrows in scope but not `row` arrows, so this is a spec gap that Codex followed, but it leaves the most common arrow in `steps`/flow rows invisible to U1/U3, and the `whole` fallback does not apply because `row` has a handler.
Fix: in `childBoxes` (for `row`) add, for every `RowArrow`, a `connector` item (`points: [(x1,y1),(x2,y2)]`) and an `arrowhead` (`headRect` on those points, end only; `arrows: 'between'` arrows end at `(x2,y2)`), with owner `${owner}>${i}`; extend T4/T7 with a `steps`-like row; and add a line to the ADR U0a table ("row arrows: connector + arrowhead").

### Minor

- **m1. The tag badge rectangle is not the rectangle that is drawn (`lib/inventory.ts:42` records `band.tagBox`; `lib/emit-boxes.ts:97` draws `snap4(t.x), snap4(t.y), snap4(t.w), t.h`).** Layout sets `tagBox` unsnapped (`lib/layout.ts:347`), so the inventory and the SVG differ. I measured 42 tags (7 labels x 3 `tagAt` values x 2 boxes): worst difference 2.00px in x, y or width. The stamp was handled correctly by extracting `stampGeometry`; do the same: `tagGeometry(band)` in `emit-boxes.ts`, used by both, and update the test that currently compares with raw `tagBox`.
- **m2. The ink rectangle is slightly small for common glyphs (`lib/inventory.ts:13-14`, constants from the Issue).** Ink pokes above the rectangle by 1.1-1.25px (parentheses/braces/brackets at 14-15px), 2.1px (Arabic), 3.25px (accented capitals, `Ω`), and below by 0.25-0.5px (`,;{}|` and descenders). It is a sliver, but `overlay-covers-text` is defined on this rectangle with a 0.5px² threshold, so a balloon edge exactly at the rectangle top can clip ink. Fix: `INK_ASCENT = 0.95`, `INK_HEIGHT = 1.25` (or pad the rectangle by 1px top and bottom), and update ADR D3/U0 and the test constants (T1 and T10 use 0.85 literally).
- **m3. Widths are not verified, and they deviate (`test/inventory.test.ts` T10; ADR U0 criterion (1)).** The ADR's U0 criterion asks for a match of position and width within 0.5px; T10 checks only x and baseline. Measured deviations are listed above (CJK punctuation trimming -7.7px, Arabic -27%, emoji +4.5px narrower than drawn). The over-estimates are safe; the emoji under-estimate is not. Fix: add a width check on a small corpus (CJK sentence with punctuation, Latin, mono, bold span) with the stated tolerance, relax the ADR criterion to "never narrower than the drawn text by more than 0.5px, wider allowed" if that is the intent, and for emoji add a margin or measure them as drawn.
- **m4. Two real gaps in the tests (my surviving mutations).** (a) Unequal wrapped lines: T3 wraps into two lines of equal width, so using line 0's width for every line passes. (b) Right alignment with an indent: the step test is left-aligned only and the centred anchor is pinned, so removing the indent from the right-aligned branch passes (the emit/inventory comparison cannot see a shared-function bug). Fix: T3 with a title that wraps to lines of different widths, checked under left, centre and right; a right-aligned `step` box pinned against an independent expectation (`frame.x + frame.w - padX`).
- **m5. Step badges and box icons are in neither the inventory nor `whole` (`lib/inventory.ts:49` `boxItems`; drawn by `renderBox`, `lib/emit-boxes.ts:117-120`).** ADR D3 lists icons and number badges as content; Issue #447 defers them to U0b ("whole のまま"), but a box handler returns frame/text/tag/stamp only, so until U0b nothing covers them. Fix: record a `badge` item (`what: 'step' | 'icon'`) from the same geometry emit uses (`stepBadgeAt`, `ICON_SIZE`, `TOP_ICON_SIZE`), or open the U0b Issue with this as its first item and say so in the ADR table.
- **m6. Leftover from the Issue: which band types have non-finite geometry (`lib/inventory.ts:55`).** `whole` returns `[]` when `x/y/w/h` is not finite and the Issue asked for the list of such types in the table comment; only `grid` is commented. Add the list (or a test that enumerates the `LaidOutBand` types with a non-finite rectangle in the example corpus).
- **m7. A throw inside `buildInventory` would be swallowed (`lib/layout.ts:386`, `layoutWith` at `:46-52`).** The inventory is built inside `layoutBands`, which `layoutWith` runs under `try { lay('bunsetsu') } catch { lay('phrase') }`; `buildInventory` uses `must()` (`lib/inventory.ts:31`, `:119`...), so a malformed `lineYs`/`lineSpans` would silently flip a figure to the phrase fallback (`wrapFellBack: true`), and then fail there. All 194 examples and the suite are fine, but the inventory is advisory: make it non-throwing (skip an item whose data is missing) so it can never change layout outcome.
- **m8. Items alias layout objects (`lib/inventory.ts:132` `points: c.points`, `:134` `rect: c.chipBox ?? c.labelBox`, `:42` `rect: band.tagBox`).** A later mutation of `connects`/`tagBox` changes the inventory silently (no pass does this today). Copy the arrays/rectangles (`{...rect}`, `points.map`), or document read-only.
- **m9. Layering (`lib/inventory.ts:2-3`).** The layout stage now imports `emit-boxes.ts`/`emit-common.ts` (and through them `reveal`, `icon-svg`, `parts`, `emit-fta`). There is no cycle and the purity test passes, and the Issue asked for sharing, but the shared placement functions (`runLineOrigin`, `boxTextPlacement`, `captionTextPlacement`, `stampGeometry`) belong in a module below both (`layout-text.ts` or `layout-util.ts`). Optional follow-up.

### Nit
- N1. `lib/types/index.ts` now re-exports `inventory.ts`, so `InventoryItem`/`ContentInventory` and the required `LaidOutDiagram.inventory` become part of the exported types; fine, but mention it in the PR body.
- N2. T10 pairs connector labels with the last `<text>` elements (`rendered.pop()`), which relies on connector labels being emitted last; a comment or an explicit selection by content would make it robust.
- N3. The ADR 0078 status line now says "一部実装済み (U0a...)"; keep the "実装は U0b から" next step visible for the next reader.

## Full test suite
`node --test "test/*.test.ts"` on the PR worktree: 3419 tests, 3399 pass, 8 fail, 12 skipped. The 8 failures (emoji font x2, Japanese system font, `layout-*` budgets, atoms agree with Chromium x2, tspan-aware lint, examples pass `lint --strict`) are exactly the machine-dependent set (fonts); I ran the same six test files on the base commit `aa16a14e` and got the identical 8 failures (106 pass), so the PR adds none.

## Verdict
**Accept with changes.** Fix M1 (row arrows) before merge, plus m1 (tag rectangle) and m4 (the two test gaps) since they are small; m2/m3 need a decision on the ink constants and the width criterion (update the ADR accordingly); the rest can be follow-ups or tracked in the U0b Issue.
