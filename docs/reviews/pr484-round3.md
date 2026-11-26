# PR #484 review (Opus, round 3)

Target: feat/venn-detail-and-dialog-position @ 158780b4585c7f0471f812e58f47095de103ed57

## Conclusion
Round 2's Major is resolved, and I checked it by behaviour. A dialog that does not fit now never throws. Only an invalid `at` throws. The edge margin shrinks when the margin is the only reason a card would not fit. A card bigger than its screen is drawn pinned to the top or left on each axis where it overflows, and `check`/`build` report it as a problem, for both `wireframe` and `screens`. Main's figure (a center card 17px too tall on `h: 140`) is now drawn, and `check` reports it with file and line. The remaining findings are test gaps and one wording issue. The behaviour in each case is right.
converged: yes.

## Previous round
- M1 (a dialog that does not fit threw): resolved. I ran a probe script on the PR head.
  - Main's figure (`h: 140`, `body: '長い本文です。'.repeat(6)`, center) builds. `checkDiagram` gives one problem, `the card (380x151px) does not fit inside the screen (594x134px); shorten …`. The card is at the screen's top-left y (23 = 23). The `repeat(20)` case behaves the same way.
  - `at: 'top' | 'bottom' | 'left' | 'right' | 'center'` with a one-line body (132px card on a 134px screen) gives no problem. The card is at y 24..156, inside 23..157, so the margin shrank to 1px.
  - Horizontal: `at: 'left'/'right'` with `w` 580/594 on a 594px screen gives no problem, and the card stays inside (x 30..610 or 23..617). With `w: 600` there is one problem and the card is pinned to the left (x = 23).
  - Too wide and too tall with `at: 'bottom'` is pinned to the left in x. In y it is placed by the shrunk margin because only the width overflows. Per axis is correct.
  - `screens([... {overlays: [wf.dialog(...)]}])` gives the same problem.
  - `at: 'middle'` still throws `at must be …`.
  - CLI `svg-diagram check --format json|text|github` lists both (wireframe and screens) as `error` findings with file:line. Exit code is 1. `build` stops before writing the SVG, which is the same path as `stamp-too-wide`. No stack trace is shown.
- m1 (nothing pins the per-line box): resolved. Replacing `boxes.push([x, y, x + lw, y + lh])` with the block-wide box `[left, y, left + listW, y + lh]` now fails 1 test (the new `wrapped item lines are checked one by one` case).
- n1 (Japanese words split mid-word): no change, as agreed.

## Findings
### m1 (Minor): the `screens` path to `wf-dialog-too-big` and the horizontal margin shrink have no test
- Evidence: I ran three mutations against `test/wireframe.test.ts`, `test/flow-shapes.test.ts`, `test/guards.test.ts` and `test/selective-bands.test.ts` (164 tests). Each one still passed 164/164:
  - removing `check: laid => dialogProblems(laid)` from `lib/screens-definition.ts:33`
  - dropping `...(ctx.problems.length ? {problems: ctx.problems} : {})` from `layoutScreenGridWith` (`lib/wireframe-layout-core.ts:949`)
  - setting `mx = edge` (no horizontal shrink) at `lib/wireframe-layout-core.ts:780`

  The `dx` clamp mutation does fail a test. The behaviour is correct today: the probes above show both the screens problem and the horizontal shrink working.
- Fix: in the existing dialog test, add one `screens([...])` case that asserts the problem, and one `at: 'left'` case with a card 4px narrower than the screen that asserts no problem and that the card stays inside.

### n1 (nit): the docs name a rule id the user never sees
- Evidence: the README (line 200) and `skills/svg-diagram/references/wireframe.md:14` say that `check` reports problem `wf-dialog-too-big`. The CLI shows the finding as `rule: "layout"`, and the message does not contain the id, because `core.ts:383` keeps only `message` for a `problem`. `stamp-too-wide` and its README text work the same way, so this follows the precedent.
- Fix: none required. If wanted, start the message with `[wf-dialog-too-big]`, as other problems do with `[rule-id]`, so the name in the docs can be found.

### n2 (nit): in `screens`, the message does not say which screen
- Evidence: a `screens` band with two screens, where only screen B has a dialog that is too big, reports `wf.dialog(): the card (103x240px) …` at the band's line. The message does not name screen B.
- Fix: optional. Add the screen title to the message when there is one.

## Checked and fine
- No layout writes to a shared `ctx.problems` more than once. `fitHeight` does not draw overlays, and state-matrix cells take no overlays, so `layoutStateMatrixWith` not returning `problems` loses nothing.
- `problems` is added to the laid-out band only when it is not empty, so serialized layouts and golden output do not change. CI `golden` passes.
- `pnpm lint`: 0 errors (26 warnings, the same as before). `pnpm typecheck`: clean. Targeted tests: 164 pass, 0 fail.
- Other open PRs: #480 and #479 touch `README.md` and the schemas, in different sections. Nothing else touches the wireframe or venn files.

## CI
Run 45770066811 on 158780b4 passed all 4 jobs: `golden`, `test (1/3)`, `test (2/3)` and `test (3/3)`.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 2)
