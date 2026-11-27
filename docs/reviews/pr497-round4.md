# PR #497 review (Opus, round 4)

Target: feat/bars-h-lines-chevron-lanes @ 5fe932bced3c7fd77eafaca27640caee900e138e

This was a short round. It checks only the round-3 fixes in 5fe932bc.

## Conclusion
M1 is resolved in behaviour. A dropped leader now shows up as a `bars` problem in every path, and the refactor draws the same figures as before: a 4000-input fuzz gives byte-identical texts, label boxes and leader lines at 2e6e564d and 5fe932bc. The horizontal half of M2 is fixed, and `perRow を減らす` is the right advice. But the vertical half was "fixed" by turning off the overflow check on vertical chevrons. A word wider than a vertical arrow now crosses its edges and `check` says nothing. The new test asserts that silence. The new M1 message has no fix advice and does not quote the label. converged: no.

## Previous round
- M1: resolved in behaviour, but the message is weak (m1 below). `bars: <label> no leader` is a layout problem. `svg-diagram check` fails with exit 1, the json output has `severity: "error"`, and it points at the `bars(` call. Decks treat it as an error. A 4000-input fuzz (different seed and generator from the test, widths 280-940, unlabelled lines, mixed tones) gives 28 inputs with `bare`. Every one of them reports the problem, and no input reports it without `bare`. With the round-3 repro, `width: 440`, shorter labels (`Upper`/`Lower`) or a wider figure each clear it. Spacing the lines out (30/60 at 320 px) does not, because each label is about 150 px wide.
- M2: resolved for the horizontal chevron, not for the vertical one (M1 below). On the horizontal chevron, the default six-step layout warns `2 番目が矢羽根より広い（語を短く・図を広く・perRow を減らす）`. `perRow: 3` and `perRow: 2` clear it, and so does `rows: 'auto'`. Lowering `perRow` widens each arrow, so the advice is right. If the reduced `perRow` still cannot hold the word, the explicit-`perRow` error fires (`N 番目のステップが矢羽根に収まらない`), and that error is also understandable.
- m1 (warning not shown by `check`): not done, and the author says so. It is still open as a Minor and is not repeated below.
- "No behaviour change" compaction (`labelPlaces`, `vlineRows`, `hlineLabels`, the leader loop now over `placed` rather than `out`, the leader drawing moved into `leaderOf`): confirmed. I exported 2e6e564d with `git archive` into scratch and ran the same seeded fuzz on both trees: 4000 inputs, h and v, 1-7 lines, labelled and unlabelled, widths 280-940. The dumps of `texts`, `labelBoxes`, `ink.lines` and the diagram height are byte-identical. `placed` and `out` hold the same objects, so the leader loop over `placed` is equivalent.
- Trimmed vertical `rows`/`perRow` error: fine. It still says what is wrong (`縦の chevron は折り返さない`), and the fix (remove the option) is obvious.

## Findings
### M1 (Major): a vertical chevron no longer checks whether a step's word is wider than its arrow, so the text is drawn across the arrow's edges and `check` passes.
- Evidence: lib/flow-chevron.ts:80 `const wide = vertical ? [] : …`. On a vertical chevron the arrow is `min(360, out.w)` wide (cellW, l.75) unless the chevron has its own `width`, so at the default 940 px it is much narrower than the figure. The "runs outside the figure" problem therefore does not catch the overflow. Repro (ran `checkDiagram`): `diagram({width: 940}).add(chevron([{label: 'Plan'}, {label: <one 55-letter word>}, {label: 'Ship'}], {direction: 'vertical'}))`. The arrow polygon spans x 290-650. The label box spans x 265-675, so it runs 25 px past each edge. At 5fe932bc the verdict has 0 problems, 0 warnings and 0 findings. At 2e6e564d the same input warned (with the wrong advice). The new test line `a vertical chevron takes no rows / perRow advice` asserts that no warning is given, so it locks this gap in.
- Fix: keep the check on vertical chevrons and change only the advice there, for example `chevron: N 番目が矢羽根より広い（語を短く・chevron に width を指定して広く）`. Change the vertical test to assert that advice, not the absence of a warning.

### m1 (Minor): the new problem `bars: <label> no leader` does not quote the label, does not say which line it means, and gives no fix. The other `bars` problems do all three.
- Evidence: lib/verify-bars.ts:30. The round-3 repro prints `bars: Lower limit long label no leader`, which reads as a sentence fragment. The sibling messages in the same function quote the label (`value label "…"`) and end with a fix in parentheses (`(raise width / height or shorten the unit)`, `(move the line, or hide the values with labels: 'category')`). Two lines with the same label (the fuzz found `Cap` twice) give two identical lines of output, with nothing to tell which line each one means. Making it an error is the right severity. It is the same kind of defect as `a reference line … runs through the label`, which is already an error. Deck `fill` search and the column fallback already treat a problem that appears only at a narrower width as a reason to keep the wider one, so this does not break deck layout. But a user who hits the error needs to know what to do.
- Fix: something like `bars: the label "<label>" (line at <at>) is raised with no leader, so which line it names is unclear (shorten the label, widen the figure, or move the lines apart)`. Assert the quoted label and the advice in the test.

## Checked and fine
- No example or golden changes. CI at 5fe932bc passed: golden (examples/out), ooxml-xsd, and test 1/3, 2/3 and 3/3. Locally, bars-h-lines, chevron-16 and the other suites this PR touches pass. 8 local failures (Chromium/emoji/Japanese font atoms, layout budget for `canvas-seven-s`, a lint of `image-labels`) involve no bars or chevron code and pass in CI, so they come from this machine's environment.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 0)

The Minor count includes round-3 m1, which is still open.
