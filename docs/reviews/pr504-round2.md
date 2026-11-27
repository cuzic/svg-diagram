# PR #504 review (Opus, round 2)

Target: feat/timeline-event-stagger @ cfed8162a73783b25e76fd3f101364085bb580bd

## Conclusion
All four round-1 findings are resolved in behaviour. In 900 fuzzed numeric timelines, no input that the default 500k limit gives up on draws at a 20M limit. The round-1 7-event repro draws. A lane that fits greedily always draws (proved by the per-flag allowance and checked with a zero base budget), and the 6,500-event lane draws. Goldens, check-diagram, the export ratchets, the timeline bundle budget and ./browser are all fine, and CI is green. converged: yes. Three Minor findings and one nit remain: the "gave up" text has no test, the `+ 20 * n` allowance has no test, and refusing a very large lane is slow.

## Previous round
- M1: resolved. Checked with a temporary env override of `budget` (not committed). Seeds 1–3 × 300 random numeric timelines (6–19 events, width 700): the default limit gave 181 drawn, 103 gave up and 616 did not fit. Rerun at 20M, 79 of the 103 that gave up became "do not fit" and none drew. With a 20,000 limit the new long-search test and the 14-mark test both fail, so both now need the larger limit. The two messages are told apart. Swapping the ternary on either axis fails one test.
- m1: resolved. The search is now an iterative loop. The 6,500-event lane test passes. Greedy uses at most 3 lefts × 5 levels = 15 steps per flag, which is less than the 20 per flag allowed, so a greedy fit can never run into the limit. With `SB=0` (base budget 0), every timeline test that fits greedily still passes. Only the 4 that need backtracking fail.
- m2: resolved for the round-1 number. After the merge with main, the body is stale again (see nit1).
- nit1: resolved. The 8-mark test asserts a clean verdict and 10 dots.

## Findings

### m1 (Minor): no test pins the "search gave up" message at the timeline level
- Evidence: I changed both callers to `throw new Error(false ? … : …)`, so a search that gives up reports the "even staggered over 5 rows" text again. All 70 timeline tests still pass. The unit test checks only `stagger().gaveUp`, and the fuzz accepts either message. The path is easy to reach. A lane with 5 short events (`label: 'a'`) far to the right of 12 close long labels at the left end gives up in about 30 ms (probe: events `at: 100+i`, plus cluster `at: i*0.3`, `Milestone label number i`, width `(100+N)*40`).
- Fix: add one `laid()` test like the probe above and assert `/search gave up/`.

### m2 (Minor): the `+ 20 * n` allowance, which the "always draws if greedy fits" claim relies on, has no test
- Evidence: I changed it to `limit = budget` and all timeline tests still pass. The 6,500-event lane needs only 6,500 × 15 = 97,500 steps, which is less than 500k. The allowance only matters above about 33k flags. The claim is correct by the reasoning above. It is just not checked.
- Fix: in the `stagger` unit test, call `stagger(mk(40000), () => [0], () => true)` (or pass `budget = 0` with a few flags) and expect `undefined`.

### m3 (Minor): refusing a large lane can take seconds, and unrelated flags turn a quick "do not fit" into "gave up"
- Evidence: the search backtracks in order and tries every alternative of the flags far to the right of a cluster that cannot fit. Each step runs `fits` over all flags, so the worst case is about 500k × n. Probe (numeric, an impossible 12-label cluster on the left plus N short flags far to the right): N=0 gives "do not fit" in 39 ms; N=5 gives "gave up" in 34 ms; N=20, 151 ms; N=50, 295 ms; N=200, 346 ms; N=1,000, 1.57 s; N=3,000, 4.9 s. Main refuses these at once. Over 1 s needs more than about 1,000 events, which is far beyond a readable figure. With realistic sizes (fuzz, ≤19 events) the slowest case at the default limit was 51 ms. Nothing draws wrongly, so this is Minor.
- Fix (optional): when a flag fails, backtrack only into flags that conflict with it (backjumping), or stop the search after the first flag that cannot fit even with every other flag removed. Otherwise, accept the cost and document it.

### nit1: the PR body's ./browser number is stale after the merge with main
- The body says 1085232 against 1085440. `pnpm bundle-size` at cfed8162 measures **1089045** against the new limit of **1,090,560** (1,515 B headroom). It fits. Only the text needs updating.

## Checked and fine
- Algorithm: the loop gives the same first-success order as greedy (lefts outer, levels inner). On backtrack it resets `t`, its own level and the previous flag's level, then continues the previous frame from `t`. On failure every level returns to -1, and `n = 0` returns `undefined`. Determinism is unchanged.
- Pure-exports / API surface: `stagger` is imported by a test, so the untested-exports ratchet passes. `lib/timeline.ts` is not a package export and is not re-exported by any public entry (`lib/types/index.ts` re-exports `lib/types/timeline.ts`, a different module). `test/pure-exports`, `public-exports` and `pure-entries` pass, and no fixture changed.
- Timeline bundle budget: `node scripts/check-package-bundles.ts` measures Spec catalog: timeline at esbuild 79435 / Vite 103719 against the new 79450 / 103730, so the raise is minimal (15 B / 11 B headroom). The script exits 0.
- Goldens / check-diagram: `check-diagram.ts --strict examples/*.ts` exits 0. `--drift` on examples/timeline*.ts is all up to date, and no file under examples/ is in the diff. CI golden passes.
- CI at cfed8162: test 1–3, golden and ooxml-xsd are green. Biome lint on the changed files is clean.
- Other open PRs: #374 and #372 touch lib/types/timeline.ts and lib/dsl/timeline-gantt.ts, not lib/timeline.ts or the bundle script.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 3 / nit 1)
