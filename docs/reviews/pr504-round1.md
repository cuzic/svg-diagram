# PR #504 review (Opus, round 1)

Target: feat/timeline-event-stagger @ cc424f02a08d67505cf419d51c9a92f4e56badb7

## Conclusion
The backtracking is correct when it finishes. It never drew an overlap in about 1,300 fuzzed figures, it is deterministic, and it gives the greedy result whenever greedy fits, so goldens and PPTX hashes are unchanged. converged: no. The 20,000-step limit is too small and cannot be told apart from "no arrangement exists". Ordinary 7–10 event inputs that do fit are still refused with a message saying they cannot fit "even staggered over 5 rows". The recursion also makes very large lanes fail with a raw `RangeError`, and main draws those lanes.

## Previous round
None (round 1).

## Findings

### M1 (Major): when the step limit runs out, the code reports that no arrangement exists, so some inputs that fit are refused with a false message
- Evidence: `stagger()` returns `false` on `++steps > budget` (lib/timeline.ts:36). That is the same result as a full search that found nothing. Both callers then throw "do not fit ..., even staggered over 5 rows" (lib/timeline.ts:124, :249). I ran a temporary test copy that reads the budget from an env var; it is not committed. Over 3 seeds × 300 random numeric timelines (4–13 events, width 700), the 20,000 limit ran out in 207 cases. With a 5,000,000 limit, 4 of those cases drew cleanly: verdict ok, no problems or warnings, 5 rows. They needed 22,014–46,287 steps. One invented repro (`unit: ''`, `from: 2008`, `to: 2027`, `step: 2`, width 700): events at 2024.5 / 2018.7 / 2015.8 / 2025.3 / 2013.4 / 2008 / 2012.5 with labels of 5, 1, 5, 5, 6, 6 and 4 copies of `"Word"`. It throws at 20,000 steps and draws at 29,839. Cost is small: 20,000 steps take about 3 ms, and the slowest 5M-step case took 180 ms. The modified test in test/timeline-source.test.ts also takes this path. The 14-mark input stops at 20,005 steps because the limit runs out. A full search proves it cannot fit, but only after 307,140 steps (about 12 ms). So the test pins the "even staggered" text on a run where the search never finished. Mutation: with `budget = 2000` every timeline test still passes, so no test needs a search longer than 2,000 steps.
- Fix: raise the limit by about 25× (500k, roughly 20 ms worst case per lane), or prune repeated states. When the limit runs out, give a different message (for example "too many close labels to arrange automatically; ..."), not the "even staggered" claim. Add one test that needs more than 20k steps and still draws, and one test for the limit-reached message.

### m1 (Minor): very large lanes now fail with a raw `RangeError`, or with a false refusal, where main draws them
- Evidence: `go()` recurses once per flag (lib/timeline.ts:30–44), so a lane that fits greedily recurses n deep. I tested evenly spaced events labelled `"a"` with `width: n*40`. In Node, 5,000 events draw, but 6,000 / 7,000 / 8,000 throw `RangeError: Maximum call stack size exceeded`. Browser stacks can be smaller. At 20,000 events the limit of 20,000 is smaller than n itself, so the search stops before it has placed every flag and the "do not fit" error is thrown. Main draws all four sizes (8,000 in 1.6 s, 20,000 in 13 s). These sizes are far beyond a readable figure, so this is Minor, but it is still a regression with a stack-trace error.
- Fix: run the old greedy loop first and backtrack only when it fails, or rewrite `go` as an explicit-stack loop. Let the limit grow with n (for example `budget + 15·n`).

### m2 (Minor): the PR body's ./browser number is wrong
- Evidence: the body says ./browser is 1068411 bytes. `pnpm bundle-size` at cc424f02 measures **1084696** against the 1,085,440 limit in bundle-budget.json (744 B of headroom). With main's lib/timeline.ts it measures 1084401, so this PR adds 295 B. origin/main is still the merge base 702139e5, so the size after merging with main is the same 1084696, which fits. Note that #501 (open) already measures over the ./browser limit after a trial merge with main, and this PR would add 295 B more to the same budget. Whichever merges second will have to deal with that.
- Fix: correct the number in the PR body. No code change is needed.

### nit1: the existing test lost its middle case
- test/timeline-source.test.ts:60–63: the 8-mark input is the one that now draws. I checked it: 8, 9 and 10 marks all draw clean on 5 rows. Moving the refusal test to 14 marks is justified and does not weaken it, apart from M1. Also asserting that the old 8-mark input now draws with a clean verdict would record the change in behaviour.

## Checked and fine
- Correctness: `fits` checks only placed flags (`level >= 0`). A stale `left` on an unplaced flag is never read, and on failure every level is reset. Mutations caught: dropping the stem rule on the numeric axis fails 3 tests; dropping it on the date axis fails 1; using greedy only on the date axis fails 1 (the new date test); the author's no-backtrack mutation fails 4.
- Overlap: the numeric fuzz (900 runs, events/lanes/spans) and a date fuzz (800 runs, now/deadline/`line: 'full'`/`span: 'fill'`, widths 600/800) showed no label, stem or lane overlap. The only date verdict problems were a remaining-time label running past the right edge (now just after the deadline near the axis end). That also happens with a single mark, so it comes from main's remaining-label placement and not from this PR. On main the same crowded inputs threw.
- Determinism: the sort is stable, candidates are precomputed, and the search has no randomness, so the same input gives the same output.
- Date-axis change: it is the same code with the same candidate order and the deadline-line filter kept. Applying it was reasonable, and it is covered by the new date test (the greedy-only mutation fails it).
- Goldens: CI `golden` is green, and `--drift` on examples/timeline*.ts is up to date. PPTX: `test/helpers/pptx/golden.ts` on the 7 timeline slides matches the manifest.
- Bundle budget: measured Spec catalog: timeline is esbuild 78891 / Vite 103083 against the new 78900 / 103100, so the raise is minimal. The other timeline cases are within their old budgets, and `node scripts/check-package-bundles.ts` passes.
- CI at cc424f02: test 1–3, golden and ooxml-xsd are all green. Of the other open PRs, #501 edits scripts/check-package-bundles.ts but not the timeline line; #374 and #372 touch lib/types/timeline.ts or lib/dsl/timeline-gantt.ts, not lib/timeline.ts.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 1)
