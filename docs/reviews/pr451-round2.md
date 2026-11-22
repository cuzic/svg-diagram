# Round 2 (PR #451 at a523987d)

Verdict: **Accept (converged). No Blocker, no Major.** Every round-1 fix is verified. Two small residuals are noted (one test gap, one measurement limit for exotic glyphs); neither needs another round. I also correct one claim of mine from round 1 (below).

## Leak check
Clean. The new diff (inventory, tests, ADR note, the committed round-1 review) has neutral sentences only and no names, paths or session ids.

## Fix verification

| Round 1 | Result |
|---|---|
| M1 row arrows | Fixed. `rowItems` (`lib/inventory.ts`) adds a `connector` and an end `arrowhead` per `RowArrow` (owner `row>i`); new test "M1: steps record the between-box arrows and the loop back to the first box" (uses `steps()` with `loopBack`). Mutations: dropping the row arrows fails 1 test, putting the head at the start end fails 1. |
| Text rectangles (top baseline - 1.0 x size, bottom + 0.3 x size, 0.125 x size per side) | Implemented as decided (`INK_ASCENT = 1.0`, `INK_HEIGHT = 1.3`, `INK_SIDE_PAD = 0.125`), documented in the type comment and in ADR U0 (line 294); T10 matches (padded width, x from the padded rectangle). Mutations: pad 0 fails 8 tests, ascent back to 0.85 fails 3. |
| m1 tag rectangle | Fixed. `tagGeometry` is shared by `renderTag` and the inventory; a direct test compares the drawn rectangle. Reverting to the raw `tagBox` fails 1 test. |
| m4 test gaps | (a) per-line width: fixed (the width-from-line-0 mutation now fails 2 tests). (b) right-aligned indent: a new right-aligned step test exists; but see the correction below. |
| m3 widths | T10 now checks the padded width against the drawn text. |
| m7 swallowed exception | Fixed structurally: `layoutBands` no longer builds the inventory; `layoutWith` builds it once after the bunsetsu/phrase decision, so a throw propagates and retries no longer repeat it. Test "T12: an inventory exception escapes bunsetsu-soft without retrying". Re-introducing a try/catch fails that test. |
| m8 aliasing | Fixed: connector points and label rectangles are copied; a test checks it (sharing `points` again fails 1 test). |
| m6 comment | Present for `grid` and `raw`. I enumerated the 190 loadable examples for any band type (outside row/grid/box/banner/caption/group) with a non-finite rectangle: none, so the comment is sufficient. |
| m5 step badges/icons | Deferred, and recorded on #448 (the U0b Issue lists `icon` items with `what: 'icon' | 'step' | 'image'` and the note about PR #451 round 1 m5). |
| m2/m9, N1-N3 | Constants decided; layering and nits left as follow-ups, which is fine. |

## Re-checks you asked for
- **Emit byte-identical:** 194/194 example SVGs (`renderSource`, real measurer) and my 16 odd inputs (rtl, bidi, rich text, wrapped, steps with all alignments, icons, tags/stamps, frameless, stat, banner, groups, emoji, connector labels, reveal) are identical to the base commit `aa16a14e`. `tsc -p .` exits 0; inventory, `core-purity` and `band-registries` pass (29/29). CI on the PR: `test (1/3)`, `(2/3)`, `(3/3)` and `golden (examples/out)` are all SUCCESS.
- **Chromium overlay with the new padding** (production pipeline, real measurer; each inventory text item matched to its `<text>`; horizontal slack = ink box edge versus padded rectangle, vertical from canvas `actualBoundingBox*`):
  - Example figures: `steps` 12/12, `canvas-swot` 18/18, `why-why` 3/3, `canvas-bmc` 44/44 matched; no glyph pokes out in any; minimum horizontal slack 0.2px (a connector label) and 1.74px for wrapped text; vertical slack at least 1px at the top and 0.2px at the bottom (digits/large text: 2px+).
  - Custom stress figures: large display text, CJK punctuation, Arabic/Hebrew/bidi, steps with icons, left/right alignment: no poke; min slack left 1.7px, right 1.25px.
  - Still pokes (all exotic): stacked diacritics (`Ǻ`, `Å` with `Ω`) reach 1.0px above the rectangle at 15px (ink ascent about 1.07em) and the line with `ẞ ǻ ǅ` 0.5px below; the emoji line `✅ 😀 👨‍👩‍👧 🇯🇵` is still 2.65px wider than the rectangle on the right (previously 4.5px), and a Latin-extended line (`Åqg ÉÀÖÜ ǅ Ω ẞ ñ ç ǻ`) 4.87px (the measurer under-measures those fallback glyphs, which is a layout-measure limit and not the inventory's). Ordinary text, CJK, Arabic, accented single letters, brackets and descenders are all covered. I would record this as a known limit in the type comment ("rectangles inherit the layout's width measurement; ZWJ emoji and rare Latin-extended glyphs can exceed them by a few px") rather than widen the padding.
- **My 3 surviving mutations:**
  1. width from line 0 for every line: now caught (2 tests fail).
  2. right alignment ignoring the indent: still "survives", **but that mutation is equivalent**; I was wrong in round 1. `lx = originX + indent + (w - indent) = originX + w`, so the right anchor does not depend on the indent. The real indent-dependent branches are centre and left: ignoring the indent for the left branch is caught (1 test fails); ignoring it for the centre branch (`lx = originX + w/2`) **still survives**: no test pins a centred box with a step badge or icon indent independently of `runLineOrigin` (emit and inventory share the function, so the shared-function bug is invisible to T10, and I found no example with step plus centre alignment to trip the golden). One test closes it: a `box({step: 1, align: 'center'})` whose text rectangle centre is `frame.x + padX + indent + (innerW - indent)/2`.
  3. `chipBox`/`labelBox` precedence swapped: survives, equivalent (the two are the same rectangle for chips).
  Additional mutations I ran against the new code (row arrows dropped, wrong end, pad 0, ascent 0.85, tag raw, aliasing, swallowed exception): all caught.

## Remaining (non-blocking)
- **Minor:** add the centred-step-indent test above (the only surviving real mutation).
- **Nit:** add the "known measurement limit" sentence to `lib/types/inventory.ts` and the ADR U0 note.

## Verdict
**Accept.** The PR is ready to merge as far as this review goes: the fixes are correct, emit is untouched, CI is green. The two items above can be a follow-up with U0b.
