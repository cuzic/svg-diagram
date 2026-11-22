# Round 2 (head 85013963)

Verdict: one Minor and two Nits remain. No Blocker or Major. The Major from round 1 is fixed. Not gated on the Minor, but fixing it is cheap: converged once m3 is fixed or accepted. CI is green (golden, test 1/3 to 3/3). Nothing was pushed, and the worktree is removed.

## Verification of round-1 fixes

| Item | Result |
| --- | --- |
| M1 trail start | Fixed. `lib/shapes/balloon.ts` takes the last crossing with `t <= reach`. A short trail puts dots that would pass the tip on the tip (`dotAt`) instead of clamping `s2`. |
| m1 byte-identity range | Fixed. The ADR note now reads `w >= 2r`, `h >= 2r` and `r >= 4`, and the test domain matches. |
| m2 English RangeError | Fixed. `body.w must be a finite number in (0, 1e6] (got 1000001)`. The argument name and value are still in the message. |
| n1 speed | Fixed. The balloon test file runs in 3.9 s (was 19 s). The 360-direction cloud test takes 2.6 s. |
| n2 `officeAdj` | Fixed. It returns `undefined` for a non-finite tip, and the ADR signature and a sentence were updated. A new test covers it. |
| n3 helpers | `f2` stays local as decided. See m3 for the `f1` import. |

## Re-runs

- **Cloud fuzz.** 20000 random tips around wide clouds (aspect 1:1 to 6:1): 0 negative lengths (round 1: 13). Tips 0.01 to 6px beyond the exit in 4000 directions: 0. I also ran 22373 tips outside the cloud at random positions near the body. 0 failed on length > 0, dot order along the trail, or finiteness. 0 had a gap under 1.9px between the first two dots when `length >= minLength`.
- **Mutation F.** Changing `exit` to the minimum crossing is now killed by `cloud trail uses the last crossing when the ray re-enters the outline`. Putting the old maximum back is killed by three of the new tests. Removing the `dotAt` clamp is killed by `cloud trail is ordered when its tip is in a notch`. Making `officeAdj` throw again is killed by `Office adjustments omit the tail for non-finite tips`.
- **Comic frozen-copy comparison.** Same script and seed as round 1: 0 differences in 197459 cases inside the range (`r >= 4`), 0 ties.
- **Other round-1 checks, unchanged.** The 180000-call non-cloud NaN fuzz and the 3000 cloud calls: 0 problems. The out-of-range calls throw the English `RangeError`. The Office evaluator gives the same maxima (rect and round 0.069 px, ellipse 2e-13).
- **Goldens.** `git diff origin/main --stat -- examples/out` is empty. The golden CI job passes. `test/comic-layout.test.ts` passes locally (29 tests).

## Remaining

### m3 (Minor). `lib/shapes/balloon.ts:2` now imports `f1` from `../comic/constants.ts`
The shared generator now depends on `lib/comic/`, while `lib/comic/balloon-path.ts` depends on the generator. D6 and the Issue describe `lib/shapes/balloon.ts` as an import-free pure function that comic wraps. This sets up a two-way dependency between the directories, and later shapes will pull in comic. `comic/constants.ts` itself only imports `tokens.ts`, so there is no file-level cycle and CI is green.
Fix: define `f1` locally next to `f2` (the coordinator already decided `f2` stays local, and the same reasoning fits `f1`), or move both to a shared `lib/` helper in a separate PR.

### n4 (Nit). Mutation F4 survives
Changing the filter to `t <= reach - 5` (ignoring crossings within 5px of the tip) passes all 17 tests. No test places a tip within about 5px beyond the exit and checks where the trail starts. Add one case with a tip 1px beyond the exit and assert `base[0]` is within about 1px of the tip.

### n5 (Nit). `docs/reviews/pr440-round1.md` is committed on the PR branch with the full round-1 text
Expected for the review workflow. Just make sure the Round 2 text is added in the same way and not left only in scratch.
