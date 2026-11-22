# PR #440 round 1 review (head 117a3d86, ADR 0077 U1)

Verdict: not converged. 1 Major, 2 Minor, 3 Nit. No Blocker. CI is green (golden and test 1/3 to 3/3).

## Blocker
None. Leakage: I scanned every added line in lib/, test/ and docs/ for non-ASCII and real-world wording. All strings are neutral. The author is the repo's usual git identity.

## Major

### M1. Cloud with a tip in a notch between two bumps: `length` is negative and the trail doubles back
`lib/shapes/balloon.ts:285`, the `exit` reduce in `cloud()`:
```ts
const exit = rayCrossings(poly, cx, cy, ux, uy).reduce((far, t) => Math.max(far, t), 0);
```
The code takes the farthest crossing of the ray from the centre. The cloud is not star-shaped for wide bodies. A notch between bumps is up to about 12px deep. A tip that is outside the polygon but inside a notch can have a crossing beyond itself.

Result: `inside: false`, but `length < 0`. The first and second dots sit beyond the tip, and the third dot is the tip, back inside the notch. The trail leaves the cloud and jumps back.

Reproduction (`balloonOutline('cloud', body, tip)`):

| body w x h | tip | length |
| --- | --- | --- |
| 327.26 x 71.03 at (0,0) | [235.72, 11.91] | -15.3 |
| 576.22 x 99.22 | [90.97, 21.84] | -29.0 |
| 167.71 x 42.10 | [120.68, 11.61] | -16.8 |

My fuzz drew 20000 random tips around bodies of aspect 1:1 to 6:1 and found 13 such cases. Tips placed 0.01 to 6px beyond the true exit in 4000 random directions gave 0. So the defect only shows for tips within about 12px of the bounding box.

This is the same family as the Issue's regression (f). The (f) test uses a different point and does not cover this.

Why Major: D6 defines `length` as a distance, and it feeds the later `balloon-tail-short` and `balloon-tail-long` checks. A negative `length` or a doubling-back trail breaks the contract.

Fix: start the trail at the last crossing at or before the tip:
```ts
.reduce((far, t) => t <= reach ? Math.max(far, t) : far, 0)
```
I applied this to a copy and re-ran both fuzzes. Negative lengths: 0 of 16000 and 0 of 20000. Add a test that sweeps tips from 0.01 to 12px beyond the outline in a notch, and assert `length > 0` and that `dots[0]` is not past `dots[2]`.

The same gap shows in the mutation run: mutation F below (changing `exit` from max to min) survives all 13 tests.

## Minor

### m1. The comic byte-identity range is narrower than decision 2 and the ADR note say
`docs/adr/0077-balloon-autoshape.md:154` and `test/balloon-outline.test.ts`.

The note says byte-identity holds for `w >= 2r` and `h >= 2r`. In fact it also needs `r >= 4`, because `balloonOutline` uses `max(radius, 4)` as the clearance.

My run: 200000 random bodies with `say`, `think` and `shout`, seed 987654321, x and y in -250..250, h 5..255, w 20..520, random `halfWidth` including negative values, and tips that are NaN, Infinity, inside, on a grid, or random. 324 of 198657 cases differed. All had `think` or `say` with 0 < r < 4, meaning `h` between 0 and 8. For example, `h = 7.17` gives base x 142.7 instead of 143.1. Once I excluded `r < 4`, there were 0 differences in 197459 cases, with 0 diagonal ties.

For real use, comic bodies are taller than 8px, so the goldens are safe. Fix: change the ADR note to "and `r >= 4`", or restrict the test domain and say so. Narration has `r = 0` but never draws a tail, so it is unaffected.

### m2. RangeError messages are in Japanese
`lib/shapes/balloon.ts:48-49`. Every other `throw new Error` in `lib/` is English (`lib/layout.ts:327`, `lib/pptx-deck-edge.ts:47`). The tests only check that the message contains the argument name and the value. Suggest English: `` `${name} must be a finite number in [-1e6, 1e6] (got ${value})` ``, with "greater than 0" for the positive-only arguments.

## Nit

- n1. `balloonOutline('cloud', {w: 1e6, h: 1e6})` takes about 0.3 s. `cloudTextRect` on the same body takes about 3.7 s, because it samples `per = 16` points per arc over about 100k arcs and does 8 point-in-polygon tests per bisection step. The new cloud test also takes 13 s on its own. It is in range, so it is correct, but consider coarser sampling for the 360-direction test, or document the cost.
- n2. `officeAdj` throws `RangeError` for a NaN tip, but `balloonOutline` draws no tail for one. The D6 text mentions only the latter. Add one sentence.
- n3. Rounding helpers `f1` and `f2` at `lib/shapes/balloon.ts:38-39` repeat `lib/comic/constants.ts:43` and others in lib/. They are repeated in many places, so I would not insist. `distanceToPolygon` and `insidePolygon` have no duplicate in lib/. The test file has its own copies of the same two functions (`test/balloon-outline.test.ts`). That is acceptable, since they act as an independent reference.

## Conformance with Issue #438 and the three decisions

- **All 7 scope items and the acceptance tests exist.** `lib/shapes/balloon.ts`, the thin wrapper, the degenerate-input rules, the tie to the sides, `cloudTextRect`, deleting `spikes/balloon-autoshape/`, and the ADR status line.
- **Decision 1 (Office round-rect comparison).** The test passes an explicit ECMA radius `ss * 16667 / 100000` and compares it with 3e-6 tolerance. No test uses the default radius. OK.
- **Decision 2 (comic byte-identity).** See m1. There is a test for `100x8 shout`, plus an ADR note.
- **Decision 3 (input range).**
  - Inputs with |value| <= 1e6 never gave NaN or Infinity in my fuzz (below).
  - Beyond the range, `RangeError` names the argument: 11 out-of-range cases (body x, w, h; tip; radius; halfWidth; NaN; zero or negative size) all threw it.
  - A non-finite tip draws no tail.
  - D6 states the range.
- **Golden.** CI golden passes. `examples/out/` has only `comic-column.svg` and `comic-grid.svg`, and the PR body says they match byte for byte.
- **Open questions** in the PR: none.

## My own checks

### Comic frozen-copy comparison
Frozen copy is `git show origin/main:lib/comic/balloon-path.ts`. Different seed and wider domain than the PR's test; see m1 for the setup. Result: 0 differences inside the stated range (once `r >= 4`), 0 ties among 197459 cases.

### Office comparison
I wrote my own evaluator that reads `gdLst` and the path points from `~/ooxml-rs/reference/ecma-376-drawingml-geometries/presetShapeDefinitions.xml`. It does not use the PR's `office-wedge.ts`. I ran 20000 random bodies (w 60 to 560, h 30 to 280) with random tips at least 3px outside, rounded through `officeAdj`.

| shape | max deviation |
| --- | --- |
| rect (3 wedge vertices) | 0.069 px |
| round (ECMA radius) | 0.069 px, `u1` difference 0 |
| ellipse (both base points and tip) | 2e-13 |

The 0.069 px is from the one-decimal rounding of base points in `d`, and it is inside the 0.1 tolerance in the Issue. The default-adj example from the Issue (200x80, tip [58.334, 90]) matches the Issue's fixed values.

### NaN and Infinity fuzz
- 180000 calls for rect, round and ellipse. Magnitudes from 1e-9 to 1e6, tips included NaN, random radius and halfWidth, follow and office. 0 throws and 0 non-finite values in `d`, `base`, `dots`, `length` or `apex`.
- 3000 cloud calls with `cloudTextRect`. Same result.

### Cloud sweep
128 bodies: h = 40 to 160 in steps of 8, aspect 1, 1.5, 2, 3, 4, 5, 5.5, 6. 720 tip directions each (every 0.5 degrees), tip at max(w,h)/2 + 60.
- The polygon check used `cloudPolygon(body, 128)`. I also checked that the SVG arc centres computed from `d` (large=0, sweep=1) lie on the sampled polygon points. 0 mismatches.
- `cloudTextRect` corners, side midpoints and 40 points along each edge are all inside the outline. 0 failures. The text rect width ratio ranged 0.435 to 0.723, wider than the test's 0.45 to 0.72 and the ADR's 49 to 70 percent, since my sizes are denser. That is a Nit-level doc issue only.
- Clearance of all three trail circles from the outline: minimum 1.95 px.
- Gaps between circles at exactly `minLength`: minimum 2.000 px.
- Only M1 (above) failed, in random tips near the bounding box.

### Mutations
The 11 from the Issue all fail the tests. Several are killed by more tests than the PR's table lists (for example 2, 3 and 6). I added 9 more:

| mutation | result |
| --- | --- |
| A. `half < 1` to `half < 0.01` | killed (comic wrapper test) |
| B. `cloudTextRect` uses corners only, no side midpoints | killed |
| C. bisection 30 iterations to 3 | killed |
| D. office half-width `sideLength / 8` to `/ 6` | killed |
| F. cloud `exit` from max to min crossing | **SURVIVED** (relates to M1) |
| G. office base centre 8.5/12 to 9/12 | killed |
| I. radius clamp `shortSide / 2` removed | killed |
| J. `CLOUD_GAP` 2 to 1 | killed |
| K. second radius `ss/18` to `ss/16` | killed |
| L. base point order swapped | killed |

### Purity and helpers
- No `node:*` import in `lib/shapes/balloon.ts` or `lib/comic/balloon-path.ts`. OK.
- Duplicated helpers: see n3.
- No manifest or config in the repo needs the new `lib/shapes/` directory; `test/core-purity.test.ts` still passes in CI.

### ADR 0078 polygon form
The API makes a polygon form moderately easy for the cloud (`cloudPolygon` already exists and is exported) but not for the other shapes. `wedgeRect` and `ellipse` build the `d` string directly, so a polygon would need either re-parsing `d` or a structured intermediate. Suggested later step: have `rectTail` and `ellipse` return a vertex and arc list that `d` and a new `balloonPolygon(shape, body, tip, opts, per)` both derive from. The wedge vertices are already available through `base`, `tip` and `side`, so the straight parts are easy. Not needed in U1.

## Scripts
Throwaway scripts for the checks are in `/tmp/claude-1002/-home-cuzic/21ae987c-b761-4464-83f8-adb7f35041b8/scratchpad/r440/` (`cmp.ts`, `office.ts`, `fuzz.ts`, `cloud.ts`, `cloud2.ts`, `mut.py`; mutation output in `mut.out`). The worktree `~/src/svg-diagram-review-440` has been removed; nothing was pushed.
