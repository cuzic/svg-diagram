# PR #489 review (Opus, round 1)

Target: fix/timeline-numeric-to-off-step @ 13f95c72a8eced8ff7e9359666afb98a7ff3f980

## Conclusion
The fix is correct and complete: `layoutNumeric` measures exactly the event labels/values, span labels (bold iff `dim`), lane names, the
`to` label (for `maxTick`) and `numericTicks` values, and after this PR `numericTexts` registers every one of them. A strict-measuring fuzz
(252 DSL cases + 42 renderDeck cases) finds no other "width was not measured", while `origin/main` fails 30 of them. The PR body's open
question on `step <= 0` rests on a wrong premise (it is already rejected by both the DSL and spec validation). converged: yes.

## Previous round
n/a (round 1)

## Findings
### m1 (Minor): the PR body says a negative / zero `step` is unvalidated and "just draws no ticks"; both are already rejected with clear messages
- Evidence (ran, spec path via `specToDiagram` + `checkDiagram`): `step: 0` -> `parts[0].step: must be between 1e-9 and 1000000000 (got 0)`,
  `step: -2` -> same, `step: 0.1` on 0-10 -> `parts[0].step: gives 100 ticks; at most 40`, `from: 5, to: 5` -> `parts[0].to: must be greater than from (5)`.
  The DSL path rejects too: `lib/dsl/timeline.ts` `numericTimeline` throws `timeline(): step must be > 0 and give at most 40 ticks`.
  (Without that validation, `numericTicks` with a negative step would emit 200 negative ticks, not zero; it is unreachable.)
- Fix: drop Open question 2 and the "negative step draws no ticks" sentence from the PR body; nothing to change in code.

### n1 (nit): the new comment says the `to` label sizes "the auto step", but `maxTick` (and so `tw(to)`) is computed for every band, explicit `step` included
- Evidence: `lib/timeline.ts:280` computes `maxTick` unconditionally; the original crash reproduces with explicit `step: 2` (the PR's own test case), so it was never only an auto-step issue.
- Fix: reword to "layout sizes the tick count by the `to` label, which is no tick when `to` is off the step grid".

### n2 (nit): the renderDeck test leaks its temp dir if `renderDeck` throws
- Evidence: `test/timeline-numeric-off-grid.test.ts` calls `fs.rmSync` after `await renderDeck(...)` with no `try/finally`.
- Fix: wrap in `try { ... } finally { fs.rmSync(...) }` or use `t.after`.

## Checks performed
- Measured vs drawn texts, read side by side (`numericTexts` vs `layoutNumeric`): events (label 700, `fmt(at)+unit` 400), span labels
  (`spanLabel`, 700 iff `dim`, auto dim label `fmt(to-from)+unit`), lane names (700), axis tick labels, and `fmt(to)+unit` for `maxTick`. All
  match in text, size and weight after the fix.
- Auto-step subset claim: with `max = 40` the fine step is `{1,2,5,10}*10^k`; for `maxTick` in 2..8 the coarse raw step is at least 5x the fine
  raw step, which always lands on a multiple of the fine step (fine 2p -> coarse 10p/20p/50p/100p, fine 5p -> 20p/50p/100p). Both start at the
  first multiple at or after `from`, so coarse ticks are a subset. Confirmed by the fuzz.
- Fuzz (scratch, not committed), `measure: 'font'` with `JA_FONTS`: 14 axes (off-grid from/to, negative ranges, decimals incl. 1/3, 1e-7,
  0.123456789, step 0.1 / 0.2 / 3 / 30, auto step, 1e9+7) x units `''`, `ms`, ` s`, `%`, `ミリ秒`, `年` x width default/600/1400, with
  lanes (incl. Japanese name), an event at `to`, dim spans with auto and explicit labels, and a labelled bar: 0 not-measured errors and 0 other errors
  on this head; 30 not-measured failures on `origin/main`. renderDeck: 0 not-measured errors (only 1e9+7 is refused by the deck loader's range
  check, as expected).
- The browser measurer and renderDeck share the same band `measure` hook (`lib/bands/timeline.ts` -> `timelineTexts`) and the strict check in
  `lib/core.ts:301`, so no separate path is left unmeasured.
- PR test fails 4/4 on `origin/main`'s `lib/timeline.ts`, passes 4/4 on head (mutation equivalent).
- Open question 1 (end label for an off-grid `to`): agree with not drawing it. A label at `to` can sit within a few pixels of the last
  grid tick and collide, and it would change goldens; the axis line still ends at `to`, so nothing is misplaced.
- Other open PRs: none touches `lib/timeline.ts`, `lib/dsl/timeline.ts` or `lib/bands/timeline.ts`.
- CI on 13f95c7: test (1/3), (2/3), (3/3) and golden (examples/out) all pass.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 2)
