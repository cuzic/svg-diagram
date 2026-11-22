# Round 2 (head 33d54b10)

Method: throwaway worktrees of the PR and of main. I diffed 8d40e050..33d54b10, re-ran the lint, typecheck and the eight relevant test files, re-ran my mutations A-D and three new ones, and re-measured the minText 10 figure. Privacy: no user-figure wording or report path in the new diff or in the committed `docs/reviews/pr437-round1.md`.

## Verification of the claimed fixes

| Fix | Result |
|---|---|
| **No behaviour change** | `lib/` changed by exactly one line (`lib/toc.ts:189`, `bestScore[0]! > 0` to `(bestScore[0] ?? 0) > 0`, identical semantics). The pins test (every figure's route hash) still passes, so the outputs equal round 1. |
| **M1 lint** | `pnpm lint`: **0 errors** (26 warnings, 14 infos, as on main plus the `Math.pow` info). `pnpm typecheck` OK. CI: golden pass, test 1/3, 2/3, 3/3 all pass. |
| **M2 tests** (`test/cause-layer-order-gates.test.ts`) | 67 of 67 pass across the eight files. See the mutation table: A-D are each caught by a test that fails for the intended reason. |
| **Scope pins for `whyWhyTree` and `band.base`** | The two pinned route hashes (`ec9e8aca39f13189`, `7c1fd8b307afabac`) equal what current main draws for the same bands (I computed them on main: 6 and 21 crossings, same hashes). The `band.base` case passes through the early `return first`, so it guards that early return, not `rowSearchOn`; fine as a scope guard. |
| **minText 10** | `test/crt-canvas-scale.test.ts` now asserts crossings === 7 and cause-crossing === 1 exactly, bends <= 52, pairs <= 1, spacing >= 10; minText 14 keeps the strict checks. The actual values on the PR are 7, 1, 52, 1, 10, so the bounds are tight (equal to the actuals), not loose; any worsening fails, and an improvement in crossings or cause-crossing fails too and forces a deliberate update. minText 18 / 24 unchanged from main. |
| **ADR 0070** | One line added under the pairs-0 criterion: the minText 10 report-shaped figure with one 10px pair was accepted by the owner (2026-11-22, ADR 0075 U1). |
| **#101 / #130** | `test/cause-order-search.test.ts` loop is now [70, 86, 101, 106, 130, 132]; #130 keeps the "taller" premise (683.75 > 637.25), #101 is excepted. The whyWhyTree comment now says "forcing `own = true` makes it change 13 whyWhyTree bands, including #101, both before and after ADR 0075", which matches what I measured (the same 13 figures before and after). |
| **Stale comment (m2)** | `test/cause-order-pins.test.ts` now says the P3 baseline is the #406 one and where the check against main lives. |

## Mutations (each applied to `lib/toc.ts`, run against the gates test, `cause-layer-order`, `layer-order-search`, cost, `pick-final-two-stage`, `cause-order-pins` and `cause-order-search`)

| Mutation | Round 1 | Round 2 |
|---|---|---|
| A. `whyWhyTree` bands run the row search | survived the full suite | **caught** (`whyWhyTree bands skip the row search ...`) |
| B. drop `inFrame` in `tryRows` | survived | **caught** (`frame: a candidate with a node in a different layer ...`) |
| C. drop the pool-stage overlap guard | survived | **caught** (`overlap: a candidate that adds a sub-4px overlap ...`) |
| D. drop the refusal check in `tryRows` | survived | **caught** (`refusal: a layout whose rows were refused ...`) |
| N1. drop the refusal check in the final `detour` (`foundRows`) | new | **survives** (56/56 pass) |
| N2. drop `inFrame` in the `pickTwoStage` filter | new | caught (`pickTwoStage: ... an out-of-frame candidate is not taken`) |
| N3. drop `passesHeight` in the `pickTwoStage` filter | new | **survives** (56/56 pass) |

The new tests are real: they stub `layeredAttempt` for the `toc.ts` instance (a `registerHooks` resolve hook plus a `?test=` query URL), alter only the forced attempt made for `tryRows`, and assert both the control (a valid candidate wins) and each rejection, so a guard that is removed cannot hide behind another one.

## Remaining findings

- **m1 (Minor): N1 survives.** When the final forced layout is refused, the unforced figure is judged as R. It can then only be taken if the ADR 0073 window selects it over M, so the figure would be a legitimate plain-order layout rather than a wrong one, but the ADR's U1 test 4 says a refused force is not a candidate at either stage. Add a case where the final `detour` is refused (extend the same stub to `routeOpts.detour`).
- **m2 (Minor): N3 survives.** The "taller only when crossings fall" rule (`passesHeight` against M's score) is not exercised at the final stage; the sample property test only bounds height at 1.25 x main. Add a unit case in `pick-final-two-stage.test.ts` (R taller than M by more than 0.5px with equal crossings must not replace M).
- **n1 (Nit): fragility.** The gates test depends on `module.registerHooks` and on plain #0's edge names (`n5`>`n7`, `n5`>`n11`), so a change to the random-CRT generator or an older Node would break it noisily rather than silently; that is acceptable and the failure would be loud. Note the minimum Node version in the test header.

No Blockers, no Majors.

## Verdict (round 2): ACCEPT, with the two minors (N1, N3) as follow-ups that need not block the merge.

All round-1 Majors and minors are fixed: lint is clean and CI is green; the scope and guard mutations A-D are now caught; the minText 10 pins are tight; the #101 / #130 and comment fixes are accurate; and `lib/` changed by one semantically identical line.

Cleanup: throwaway worktrees and the review branch are removed.
