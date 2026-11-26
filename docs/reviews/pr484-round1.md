# PR #484 review (Opus, round 1)

Target: feat/venn-detail-and-dialog-position @ 27daed909b76057b91fbf627fbb48bf5cd9a97d7

## Conclusion
The venn fit check is sound in the direction that matters: a random search of 4,000 two- and three-set layouts (rough widths, items 1–24 chars, widths 300–1300) found no layout where a title or item crosses a circle and is not flagged. The PR is still not mergeable. CI is red because the PR itself adds 4 biome errors. The "outside the other circles" half of the check, which is what keeps 3-set items out of the neighbouring circles, has no test. A dialog card taller than its screen leaves the screen silently, and `top`/`bottom` hit this sooner than `center`.
converged: no.

## Previous round
None (round 1).

## Findings
### M1 (Major): the PR adds 4 lint errors, so CI `test (1/3)` fails and that shard's tests, bundle check and example check never ran
- Evidence: `pnpm exec biome lint --diagnostic-level=error .` on the PR head gives exactly 4 errors, all `lint/style/noNonNullAssertion` at `lib/flow-venn.ts:73` (`x!`, `yy!` in the `fits` lambda). CI run 45766587478, job `test (1/3)`: "Found 4 errors", exit 1 at `pnpm lint`. On main, run 45765399391 (908e3baa) found 0 errors and 26 warnings, and main @ b4d2c3a4 is green on all four jobs. The PR description says the lint errors are pre-existing in untouched files. That is not right: the `build-diagram.ts` / `check-diagram.ts` / `viewer.css` entries in the log are warnings, the same 26 that main has.
- Fix: destructure the corners as typed tuples (e.g. `const corners: Pt[] = [...]` and `([x, y]) =>`) so no `!` is needed, then re-run CI so shard 1 actually executes.

### M2 (Major): the "outside the other circles" clause of the venn fit check has no test
- Evidence: I deleted `&& pos.every((o, j) => j === i || dist(x!, yy!, o) >= r + 2)` from `lib/flow-venn.ts:73`. All 6 venn tests in `test/flow-shapes.test.ts` still pass. The misfit test (`width: 320`, long items) only trips the own-circle clause. With the clause removed, the random search finds 3-set layouts whose items cut 5–22px into a neighbouring circle without being flagged, e.g. 3 sets, width 526, items on set 1 `["C2eC1説F0B特d10きこ特いかa","けE漢きGH11こbおg特字bおh徴漢G"]`. So this clause is what makes the 3-set case correct, and nothing pins it. The new first test also checks only two corners of each text box (top-left and bottom-right).
- Fix: add a 3-set case whose block fits inside its own circle but crosses a neighbour, and assert `misfits` (or the verdict problem). Check all four corners in the placement test.

### M3 (Major): a dialog card taller than its screen leaves the screen, and `check` passes
- Evidence: two bands, `wireframe([wf.text('main')], {h: 140, overlays: [wf.dialog('確認', {body: '長い本文です。'×20, buttons: [wf.btn('はい')], at})]})` and then `wireframe([wf.text('次の帯')], {h: 80})`. The screen is y 20–160, the card is 230 tall, and the next band starts at y 176.
  - `bottom`: card y −89…141. Its top, including the dialog title, is above the canvas.
  - `top`: card y 39…269. It covers the next band.
  - `center`: card y −25…205. This is the same hole, and it already exists on main.

  `renderDiagram(...).verdict.ok` is true in all five positions, with no problems. `lib/wireframe-layout-core.ts:778-779` positions the card with no clamp. Because of the 16px edge margin, `top`/`bottom` leave the screen once `dh > h − 16`, sooner than centring does. The brief for C4 is that the card stays on the screen and off the content, so this is the case that needs covering.
- Fix: clamp `dx`/`dy` so the card stays inside `[x, x+w] × [y, y+h]`. When `dh > h − 2·edge` or `dw > w − 2·edge`, report a problem (or throw) that says to shorten the body or make the screen taller. Do this for all five positions.

### m1 (Minor): the JSON schema accepts `items: []`, which the builder rejects
- Evidence: `schema/spec.schema.json` has `"minItems": 0` for `sets[].items`, because `list(..., 4)` in `lib/spec-parts/venn.ts:10` sets no minimum. `svg-diagram spec` on `{"version":1,"title":"t","parts":[{"type":"venn","sets":[{"name":"A","items":[]},{"name":"B"}]}]}` passes the schema and editor validation, then fails at render with `parts[0] venn(): set "A" items must be 1 to 4 non-empty strings`. The message is clear; the two sides just disagree.
- Fix: `list(text(...), 4, 1)` and re-run `pnpm schema`.

### m2 (Minor): a wrapped item is checked as one box, so some figures that fit are rejected
- Evidence: `lib/flow-venn.ts:70` pushes `[left, y, left + q.w, y + q.h]` for the whole wrapped item, so a short last line is checked as wide as the longest line. With 3 sets at width 640 and set 甲 holding one item, `とても長い特徴の説明がここに入る`, the check reports a misfit even though every drawn line clears all circles by 12px. In the random search, 147 of the 1,342 flagged layouts had at least 4px of real clearance. This errs on the safe side (rejecting, not drawing badly).
- Fix: check each drawn line's own box, using per-line widths, rather than the bounding box of the whole block.

### m3 (Minor): wrapped items have no hanging indent and break mid-word
- Evidence: a continuation line starts at the `・` column (the dump shows `・とても長い特徴の説明がこ` / `こに入る`, both at x 158.67). In the deck test, slide 2 (a two-column slide) wrapped `・拡張しやすい` as `・拡張しや` / `すい`. Both make the list harder to read as bullets.
- Fix: indent continuation lines by the width of `・`, and wrap items with words kept together (as `keepWords` does elsewhere), or flag a word that has to be split.

### n1 (nit): with both `label` and `items`, the bold title is `label`, and `name` is not drawn
- Evidence: `lib/flow-venn.ts:65` uses `s.label ?? s.name`. The README text says the name is the bold title. Either say that `label` replaces the title, or reject `label` together with `items`.
- Fix: one sentence in the README or skill.

### n2 (nit): the dialog test does not pin the 16px edge margin
- Evidence: changing `x + edge` to `x` for `left` leaves the test passing (it compares only against the centre).
- Fix: assert `left.x === screen.x + 16` and the equivalent for the other edges.

## Checked and fine
- 2-set and 3-set placement, Japanese and Latin text: no unflagged crossings (4,000-case random search plus a fixed grid). Titles and items go through `vennTexts`, so `strict-width` measures them.
- Deck: `pptx-deck` built a 3-set slide and a two-column slide with items. In the PPTX, the items are native text boxes, left-aligned (`algn="l"`), and the titles are centred. The misfit problem goes through `flow-definition.ts`'s `check`, so decks and specs report it.
- Golden CI passes; the only new golden is `examples/out/venn-features.svg`. Wireframes are exported to PPTX as images, so `at` needs no PPTX change.
- Local run on the PR head: the venn/wireframe/spec/schema/exports tests (217) and typecheck pass.
- CI shard 1, run locally (it did not run on CI because of M1): `bundle-size`, `build` + `check-package-bundles`, and `check-diagram --strict examples/*.ts` pass. The shard's tests give 1384 pass and 4 fail. The 4 failures are `font-metrics` atoms ×2, `rich` tspan lint and `lint-cli` examples. The same 4 fail on origin/main in this environment, so they are local font/environment differences, not this PR.
- Tests written after the code: I ran the PR's `test/flow-shapes.test.ts` and `test/wireframe.test.ts` against origin/main's code. 4 of the 5 new tests fail there: the venn placement, misfit and validation tests, and the dialog `at` test. The fifth, "few short items pass the verdict", passes on main by construction. So the new tests do exercise the new behaviour, except for the gaps in M2 and n2.
- Other open PRs: #480 and #483 also regenerate `schema/spec.schema.json`, and #479 and #480 also edit `README.md`, in different sections. A conflict in the schema should be resolved by re-running `pnpm schema`.

## Open questions (recommendations)
- **Cap of 4 items / 24 characters**: keep both. Measured capacity with 14px text (Japanese, all items the same length; widths are band widths):

  | Sets | Width | Longest item that fits, by number of items |
  | --- | --- | --- |
  | 2 sets | 640 | 4 items: 14 chars; 1–3 items: 24 chars |
  | 2 sets | 892 | 4 items: 24 chars |
  | 3 sets | 640 | 1 item: 12; 2: 9; 3: 7; 4: 5 chars |
  | 3 sets | 892 | 1 item: 24; 2: 15; 3: 13; 4: 11 chars |

  The check catches what does not fit, so lowering the schema cap would only refuse 2-set figures that fit. Instead, put this guidance in the README and skill: for 3 sets, 2–3 items of about 8 characters.
- **3-set exclusive regions are small**: do not enlarge the circles in this PR. That would change every existing 3-set golden. If users keep hitting the misfit problem, the follow-up is items outside the circle with a leader line, like `concentric` `labels: 'side'`.
- **Dim off (`dim: false`)**: leave it out until someone asks for it. `at` already keeps the content visible. M3's clamp matters more.

## Verdict
converged: no (Blocker 0 / Major 3 / Minor 3 / nit 2)
