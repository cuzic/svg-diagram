# PR #497 review (Opus, round 2)

Target: feat/bars-h-lines-chevron-lanes @ 8797ad59ae8da12045a3cb7922bd65fddfa353f1

## Conclusion
M1 (lane wrapping) is fixed, and so are m2 and m3. M2 is fixed only when a clean placement exists. When no placement can keep every leader clear, `labelRows` goes to its fallback. The fallback says the leaders are "given up", but the layout still draws them through the other labels. `check` passes. Two labelled lines on a 320-px figure are enough to reach this. The m1 width check is sound for explicit `rows: n` / `perRow`. It skips `rows: 'auto'` on the assumption that auto always fits, and that is not true: auto measures line counts, not widths. The qc test rewrite is not a weakening. converged: no.

## Previous round
- M1: resolved. `wrapLane` is replaced by `wrapText(…, mode: 'phrase')`. I re-ran all four round-1 lanes. Katakana and kanji runs stay whole. No line starts with a small kana, `ー` or `・`. A katakana word wider than the column (width 560) is still split, which cannot be avoided, and `text-mid-word-break` reports it. The `timeline` esbuild budget is 78600. Residual: see m2 below.
- M2: partly resolved. Solvable cases are handled: the depth-first search keeps leaders clear, and turning off the `strict` leader rule (mutation) fails 2 tests. Unsolvable cases still overlap silently: see M1 below.
- m1: resolved for explicit `rows` / `perRow`. The round-1 input (16 Latin steps, `rows: 2`) now errors, and turning the throw off (mutation) fails the new test. The gaps that remain are in m1 below.
- m2: resolved. The new tests assert one soft leader per raised label and that no leader crosses a label.
- m3: resolved by documenting it. `BarsOpts.height` now says that the label rows are added above the height.
- n1: not addressed. It was optional.

## Findings
### M1 (Major): when no placement keeps every leader clear, the line-label leaders are still drawn through other labels, and `check` passes.
- Evidence (ran `checkDiagram`): horizontal bars at `width: 320`, `max: 100`, `lines: [{at: 30, label: 'Upper limit long label'}, {at: 38, label: 'Lower limit long label'}]`. The first label is at x 84-234, y 38-56 (row 0). The second is on row 1, and its leader is drawn at x=172 from y 38 to 56, straight through the first label. `problems` and `warnings` are both empty. The cause: each label is about 150 px wide in a 280-px band, so neither label fits beside its line (`start` and `end` both leave [lo, hi]). Each label can only be centred, and each one covers the other's line. `labelRows` has no clean answer, so it falls back to "leaders given up". lib/bars.ts:307 and :409 still push a soft leader for every label above row 0, so the leader crosses the label below it. A fuzz of 3000 random inputs (1-7 close lines, widths 320/560/940, both `lines` and `vlines`) found 263 inputs with a leader across a label and zero problems. Most had 6-7 lines, but there were 1 with 3 lines and 6 with 4. The `vlines` path behaves the same way.
- Fix: make the fallback not silent. Either drop the leader in the fallback and do not draw it through a label, or report the crossing (a `check` problem that says to widen the figure or shorten the labels). Add the two-line repro above as a test.

### m1 (Minor): the chevron width check skips `rows: 'auto'` and the default one-row layout. Both can still draw a word across the arrow outlines with no error.
- Evidence (ran `checkDiagram` on a 940-wide spec):
  - `rows: 'auto'`, 16 steps of `Step`, one of them `Internationalization`. `autoPerRow` picks 8 per row (cell x 585-694), and the word is drawn at x 570-708, across the notch, the point and the gap into the next arrow. There are 0 problems. `autoPerRow` (lib/flow-chevron.ts:29-46) counts wrapped lines, and an unbreakable word is one line however wide it is, so `labelFits` is true. The candidate with 4 per row (text room about 179 px) would have fitted the word.
  - With no `rows` / `perRow`, 6 or 8 Latin steps (`Requirements`, `Implementation`, …) draw over the outlines: 8 steps put `Implementation` at x 131-243 in a cell at x 133-242. There are 0 problems. The same steps with an explicit `rows: 1` now throw. The condition `b.rows === b.perRow` is true only when both are unset, so the same layout errors or passes depending on whether `rows: 1` is written.
  - Both gaps are older than this PR (`autoPerRow` and the one-row layout are unchanged), so this does not block. But the comment and the commit present `'auto'` as safe, and it is not.
- Fix: in `autoPerRow`, count a block whose width exceeds `textW` as not fitting (`labelFits` / `subExtra`). Then run the width check for every horizontal layout, or at least warn for the default one when the error would break existing figures.

### m2 (Minor): the `text-mid-word-break` advice for a lane name still says `keepWords`, and `keepWords` still has no effect on lanes.
- Evidence: `デジタルトランスフォーメーション推進プロジェクト室` at width 560 gives the same three lines and the same warning, which suggests `diagram({keepWords: true})`, with and without `keepWords: true`. `layoutNumeric` passes a fixed `mode: 'phrase'` and never widens `laneCap` for the longest katakana word.
- Fix: under `keepWords`, raise `laneCap` to the longest katakana word, or leave `keepWords` out of the advice for timeline lanes.

### n1 (nit): the chevron error says `N 番目の文字` (the Nth character) but means the Nth step, and the qc test's title still says the label "goes a row higher".
- Fix: say `N 番目の段（ラベル「…」）` and update the test title.

## Checked and fine
- qc test rewrite (test/qc.test.ts): not a weakening. The old assertion (different y) encoded the old one-candidate placement. The new one asserts that the two boxes do not overlap, which is the property that matters, and a three-label case must still use ≥2 rows. Turning off the leader rule fails the suite. The bars-h-lines "more than one row" assertion was removed in 0af357f2, but the four-label `CLOSE` case still requires a raised label.
- Side placement does not add overlaps: a `start` / `end` label at row 0 sits above the plot. Only soft leaders rise above the plot, and on the clean path the strict rule covers them. In the fuzz, label-label, label-vs-value/axis/category and outside-figure overlaps all came with a `check` problem, or came from inputs whose category labels already overlapped at 320 px.
- Explicit `rows` / `perRow` with short or Japanese labels: no new false errors (chevron-16 tests, the ADR 0082 tests, golden).
- Merge ce15f391: only brings in main. The PR's own diff since 0af357f2 is limited to lib/flow-chevron.ts, test/chevron-16.test.ts and test/qc.test.ts.
- CI at 8797ad5: golden, ooxml-xsd, test 2/3 and 3/3 pass. Test 1/3 was still pending at review time. Locally, bars-h-lines, chevron-16, timeline-lane-30 and qc pass (83/83).
- Other open PRs: #374 and #372 touch lib/types/timeline.ts, but not the lane-name code. No shared code with lib/bars.ts or lib/flow-chevron.ts.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 1)
