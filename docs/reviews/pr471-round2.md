# PR #471 review (Opus, round 2)

Target: feat/comic-row-layouts @ 5336499e27d9e91a14ca6bb6ee35c079d86050d8

## Conclusion
converged: no. All round-1 findings are resolved by behaviour: `4x1` fits `canvas: 'slide'` and renders on a real deck slide with no errors or warnings, two-speaker row panels with short lines are clean at 14–28, `fontSize: 28` fits, the mutations from round 1 now fail tests, and filling blanks never moves geometry (shrink-to-text included). Two new Majors come from the round-1 fixes: deriving the panel width from `w` has no lower bound, so a 4x1 in a narrow diagram draws broken panels with no finding; and row panels drop the D2 reading-order rule, so a right-then-left exchange is drawn with the reply read first.

## Previous round
- M1 resolved: ran `check examples/comic-row.ts` (`canvas: 'slide'`, 4x1, fontSize 24): ✓; panels are 280px (1212 / 4). I rendered it on real deck slides with `renderDeck` (deck.json `{figure: 'fig.ts'}`, with a title, without a title, and with `fit: 'fill'`): no errors and no warnings. The figure is placed at 1027.56x578 on a titled slide, a scale of 0.80, and at 1152x648 without a title, a scale of 0.90. The 24px dialogue therefore shows at about 19px and 22px on the slide. The deck's own small-text floor accepts this. It is the general behaviour of a `canvas: 'slide'` figure inside a deck, not something this PR introduced.
- M2 resolved: `layoutComic` at w=1212, two speakers left/right, `はい。` in 4x1/3x1/2x1 at 18–28: no findings, bubbles side by side. A 15-character line gives `comic-text-budget` ("4 lines in one bubble… shorten the lines"). That is an honest, actionable finding, as the parent decided.
- M3 resolved: `うん。` at fontSize 28 in 4x1/3x1/2x1: no findings. The width message in a row now names fontSize, columns, diagram width and blank.
- M4 resolved: re-applied all four round-1 mutations (width check removed, `comicMeasure` at FONT, glued at 162, `valueAtoms` at FONT). Each now fails one test. The new paths are also covered: removing the half-width cap, turning off shrink, a fixed badge height, a fixed `zoneTop`, a fixed stageX of 76 and the renderComic width each fail at least one test. The exception is m1 below.
- m1 resolved as the parent decided: the badge, prompt, `zoneTop` and `narrationLeft` scale with fontSize. With `numbering: false` and `blank: 'line'`, the band draws only 24px text, and the prompt is not drawn, so it is not counted (no exemption). The test "blank: \"line\" draws no prompt…" covers this.
- nit1 resolved: heads now keep a 4px gap (64/140/216 in 280px), and the test checks every adjacent pair ≥ 76.
- Blanks never move geometry: verified by behaviour. `renderComic` 4x1/3x1/2x1 × fontSize 14/18/24/28 × `blank` prompt/line × one or two speakers, empty vs three value sets. These included over-long values (`MMMMMMMM` in a max-4 blank) and Latin/kana mixes. `geometry` is deep-equal in every case, and the SVG outside the slots and titles is identical. The shrunk width counts a blank at `max × font` and never reads values.

## Findings

### M1 (Major): a row layout in a narrow diagram draws broken panels and `check` passes
- Evidence (ran): `panelSize` clamps the share to `Math.max(4, …)` (lib/comic/layout.ts:32-33), and stageX bottoms out at `HEAD_R + 4` = 40 (layout.ts:60). `checkDiagram(diagram({width: 480}).add(comic(<4x1, panels with no dialogue>)))` gives problems `[]`. The panels are 100x132, and the heads at x 40 and 60 overlap by 52px. With three people the heads are at 40/48/60. At `width: 360` the panels are 52x68 with the left head at 40 and the right head at 12: the people are swapped and mostly clipped. At w=100 a panel is 4x4. The same happens in a deck column narrower than about 1000px. Round 1 had fixed 300px panels, so this case overflowed the canvas and was reported. Now it is silent unless a panel has a bubble. If one does, the message says "at most -3 lines in all", a negative budget. The skill's own comic example uses `diagram({width: 480})`, so switching its `layout` to `4x1` reproduces this.
- Fix: set a minimum row panel width (one that holds two heads plus a one-line bubble, e.g. ≥ 200). Below it, raise a comic problem once per band that names the needed `diagram({width})` or fewer columns, instead of drawing. Add a test for `width: 480` 4x1.

### M2 (Major): row panels break the D2 reading-order rule; a right-then-left exchange is drawn with the reply read first
- Evidence (ran): ADR 0074 D2 (normative, docs/adr/0074-comic-worksheet-parts.md:72) says "同じ高さに並べてよいのは、先のふきだしがすべて自分より左にあるときだけ… 台詞の順が右から左なら、2 つ目は 1 つ目の下になる". The implementation note opens with "D1・D2 の決定は変えない", yet it drops this rule for rows: `(!row && left < q.x)` at lib/comic/layout.ts:125. Ran 4x1, fontSize 18, `fr` (right) `もう帰る？` then `me` (left) `うん、帰る。`. The first bubble is at (180,32) and the second at (32,32): same height, with the reply on the left, so it is read first. No finding and no `comic-reading-order`. The test "two speakers in one row panel: … in both orders" asserts this (`x.y === y.y`). The exception is not needed: when I restored `left < q.x` for rows, the same input stacks the reply below (32,86) with no findings at any fontSize. The half-width cap already keeps the tails apart. The only thing that fails is that "same top" assertion.
- Fix: keep `left < q.x` in rows, as D2 requires. Change the test so the right-then-left order is stacked without findings. Remove "2 つのふきだしは、横に重ならなければ同じ高さに並べる" from the ADR note, or explicitly amend D2 (with the reading-order consequence) if the parent wants it.

### m1 (Minor): the fontSize-scaled narration offset is not covered by tests
- Evidence (ran): mutating `px + m.narrationLeft` to `px + 20` (layout.ts:122) leaves comic-row-layout, comic-layout, comic-wrap, comic-values, comic-render and comic-band all passing (105/105). At fontSize 28 the badge reaches 29px into the panel, so a narration at 20 would sit under it.
- Fix: assert that a narration's x at fontSize 28 is `panel.x + 33`, or clear of the badge.

## Notes
- Open PR #473 (chat U5) conflicts with this PR in `lib/comic/{reserve,emit,layout}.ts`, README and ADR 0074, based on a trial `merge-tree`. It re-parameterises `templateAtoms` and `reserveAtoms` differently (`innerMax` and `cap`, not `font` and `{cap, shrink}`). #473's own round-1 review already records this. Whichever PR merges second must reconcile the signatures.
- CI at review time: golden pass, test (2/3) and (3/3) pass, test (1/3) pending. Targeted local runs: 105/105 across the six comic test files.

## Verdict
converged: no (Blocker 0 / Major 2 / Minor 1 / nit 0)
