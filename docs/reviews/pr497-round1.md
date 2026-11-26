# PR #497 review (Opus, round 1)

Target: feat/bars-h-lines-chevron-lanes @ e22423bac0a64fdff8104a146ad59df0aace9c16

## Conclusion
B4 is correct: the limits are raised, `rows: 'auto'` gives a clean 4 x 4 layout, and the slide warning still fires for `perRow: 2`. B2 mostly works: value labels are moved off the lines and `check` catches a line through a value (mutation killed). One label-row case still overlaps silently. B5's custom lane wrapper breaks katakana and kanji words and puts kinsoku-forbidden characters at the start of a line. The repo's own `text-mid-word-break` check flags some of these breaks, and its suggested fix (`keepWords`) does nothing for timeline lanes. converged: no.

## Previous round
None (round 1).

## Findings
### M1 (Major): B5 `wrapLane` splits Japanese words and breaks kinsoku. `check` misses some of these breaks, and its fix advice for the others does not work.
- Evidence (ran `specToDiagram` + `checkDiagram`, numeric timeline, `unit: 'ms'`, 0-700):
  - default width, lane `デジタルトランスフォーメーション推進プロジェクト室` → `デジタルトランスフォーメーション推 / 進プロジェクト室`. The kanji compound 推進 is split with no warning.
  - width 560, same lane → `デジタルトランスフ / ォーメーション推進`. Small `ォ` starts a line, and the word is split mid-katakana.
  - width 560, lane `カスタマーサクセス・オペレーション推進グループ` → `カスタマーサクセス / ・オペレーション推 / 進グループ`. `・` starts a line with no warning.
  - default width, lane `ショッピングチャネルのキャッシュレス・ペイメント` → `…キャッシュレ / ス・ペイメント`. In both a document and a slide this gives a `text-mid-word-break` warning that says to use `diagram({keepWords: true})`. With `keepWords: true` the lines are identical and the warning stays, because `keepWords` has no effect on timeline lanes.
  - lib/timeline.ts:12-21 only refuses `、。）」,.)` at the start of a line. `lib/wrap.ts` has the full `CANNOT_START_LINE` (small kana, ー, ・, ！？ …) and `CANNOT_END_LINE` (（「【 …) sets, and `phrase` mode keeps katakana and kanji runs together.
  - Size of the trade-off (esbuild `--minify`, measured): `wrapText` from lib/wrap.ts is 2894 B, `splitAtoms` alone is 378 B. Reusing wrap.ts costs about 2.5 KB in the `timeline` selective bundle, about 3% of 76.8 KB. The full `./browser` bundle already contains wrap.ts, so the cost lands only on the selective bundle. That bundle's budget is a number in scripts/check-package-bundles.ts. The custom wrapper instead gives lane names worse wrapping than every other text in the library.
- Fix: replace `wrapLane` with `wrapText(name, {maxWidth: laneCap, atomWidth, mode: 'phrase'})` (or `wrapBalanced` for even lines) from lib/wrap.ts. Set the `timeline` esbuild budget from a fresh measurement (about 79.5 KB). Add tests that a katakana word such as トランスフォーメーション stays on one line and that no line starts with `ォ`, `ー` or `・`. Today, a mutation that makes the kinsoku regex always pass (`!/^[\s、。）」,.)]/.test(a)` → `true`) survives `test/timeline-lane-30.test.ts`.

### M2 (Major): B2: the leader of a line label on a higher row runs through the label of another line on a lower row, and `check` passes.
- Evidence: `bars([{label:'Alpha',value:80},{label:'Beta',value:55}], {max:100, lines:[{at:50,label:'First target long label'},{at:53,label:'B'}]})`. `B` goes to row 1, and its soft leader is drawn at x=505 from y=38 to y=56 (SVG `M505,38 L505,56`). The row-0 label `First target long label` spans x 407-554, y 38-56, so the dashed leader crosses the text. `verdict.problems` and warnings are both empty. The cause is in lib/bars.ts `hlineLabels`: it only checks label-vs-label overlap on the same row. It never checks whether a label's line or leader x falls inside a label already placed on a lower row. The existing `vlineRows` (vertical bars, `vlines`) has the same gap; the same input with `dir:'v', vlines:[{at:1,…},{at:1.1,…}]` reproduces it on main. This PR copies that gap into a new path.
- Fix: in `hlineLabels`, also raise a label when its line x falls inside (with a margin) any label placed on a row below its own. Alternatively, bump the lower label instead. Add a test that no leader crosses a label box. Optionally fix `vlineRows` the same way.

### m1 (Minor): B4: 16 steps with `rows: 2` (or `perRow: 8`) on a 16:9 slide draw Latin labels across the chevron outlines with no error or warning.
- Evidence: a deck slide of 16 English steps (`Requirements`, `Implementation`, `Stabilization`, `Retrospective`, …, each with sub `owner and due date`), `rows: 2`. `renderDeck` gives errors [] and warnings []. In the PNG, those words run over the arrow edges. The same input on main (12 steps, `perRow: 8`) looks the same, so the layout and check gap is older than this PR. What is new is that `rows: 2`, a natural request for 16 steps, now produces 8 per row (before, `rows: 2` meant at most 6 per row). `rows: 'auto'` (the documented path) is clean: 4 x 4, no wrapping, in both Japanese and English.
- Fix: open a follow-up for a chevron text-vs-outline check, or have `rows: 2` with 16 steps warn. This does not block the PR.

### m2 (Minor): test gaps in B2.
- Evidence: a mutation that removes the leader lines (`if (at && at.row > 0) ink.lines.push(...)` → `if (false)`) passes all of `test/bars-h-lines.test.ts`. Nothing asserts that a raised label is connected to its line. A mutation that makes `cuts` always false is killed (4 tests fail), so the value-label avoidance is covered.
- Fix: assert that a soft leader exists from each row > 0 label down to the line, together with the M2 test.

### m3 (Minor): B2: an explicit `height` on horizontal bars with labelled `lines` is exceeded.
- Evidence: lib/bars.ts: `h = (band.height ?? needH) + top`. With `height: H` and one row of labels, the band is H + S + 8 tall (read from the code, not run). The user's `height` no longer bounds the band, and `BarsOpts.height` does not say this.
- Fix: count the label rows inside `height` (and in the "too small" message), or document that the label rows are added on top.

### n1 (nit): in PPTX a wrapped lane name becomes one text box per line.
- Evidence: `svg-diagram pptx` on a copy of examples/timeline-ms.ts with a long lane gives `<a:t>カスタマーサクセス・オペレーション</a:t>` and `<a:t>推進グループ</a:t>` as separate shapes. Positions are correct, but editing the name in PowerPoint means editing two boxes. The pptx-golden run on this head (workflow_dispatch 45812670641, `✓ 203 slides match the manifest`) passes, but no example has a lane long enough to wrap, so the golden does not cover B5.
- Fix: optional. Emit the lines as one multi-paragraph text box, or add an example with a wrapping lane to the PPTX golden.

## Checked and fine
- Vertical-bar `lines`, `vlines`, `curve`, `cumulative` and `edges`: `layoutVertical` is unchanged. `golden (examples/out)` and pptx-golden pass.
- B2 probes with no overlap and no false problem: a line at 0 with a label, a line at max with a long label, four close Japanese labels on a 320-px figure (rows plus leaders, inside the figure), several lines all through one short bar's value, a long bar cut by lines at both inside positions (the value moves beside the bar), range bars, `grid`, `axis: false`, `labels: 'category'`, bars inside `row()`. Lines outside 0-max and stacked or `vlines` on horizontal bars are still refused with a clear message.
- B4: 16 steps in Japanese and English, with and without sub, `rows` auto/2/3/4, `perRow` 8/4/2, in a document and on a slide: no problems. `perRow: 2` on a slide gives the "scaled to 72% … under 9pt" warning, as it should. 17 steps and `current: 17` are refused.
- B5: width measurement is consistent. The wrapped lines are whole atoms of the prefetched lane text, and `textWidth` sums atoms, so strict and batched measuring in `renderDeck` see no unmeasured text (the slide tests and probes give no errors). A single overlong Latin atom (`Internationalization_readiness`) widens the column past the cap instead of overflowing it.
- CI at e22423b: all checks pass. The targeted tests (bars-h-lines, chevron-16, timeline-lane-30, spec-r1) pass locally (17/17).
- Other open PRs: only #493 also touches README.md, in a different section. No shared code.

## Verdict
converged: no (Blocker 0 / Major 2 / Minor 3 / nit 1)
