# PR #483 review (Opus, round 3)

Target: fix/compare-row-header-and-cols @ 596dc82496f49c577297dd87b9447453f45bb616

## Conclusion
Round-2 M1 is resolved. Ruled column heads now try `colW - 16` first and fall back to main's `colW - 8 / colW - 4` instead of throwing, so no short-row-name case that main drew fails any more. Of the 30 e2e OK→ERR cases from round 2, 28 now draw. The 2 that still fail, and the remaining layout-sweep failures, all have a long row name that narrows the columns. That is the trade-off already accepted as round-2 m1, and the PR body now documents it. m2 is resolved. One test gap is left (Minor): the preferred 16px padding is not pinned. converged: yes.

## Previous round
- M1 (ruled heads throw): resolved. I reran both round-2 sweeps on this head against the saved main results. Real-font e2e `checkDiagram(compare)` (720 cases): OK→ERR dropped from 30 to 2, and ERR→OK is 24. Layout sweep (10,800 cases): ruled OK→ERR is now compare 14 and ruled harvey 14 (round 2: 64 and 58). Every remaining OK→ERR case has a long row name ("Telecommunications Infrastructure", "Internationalization(s)", "Hypertransportabilityness"). None has a short one such as `Cost`. These cases use the same head limits as main (`colW - 8 / colW - 4`), so the failure comes from the narrower `colW`, which is m1 below and not the head limit. The new test fails when the fallback is removed (mutation A: heads use `fit(colW-16, colW-16)` only → 1 fail).
- m1 (wider row headers squeeze columns): accepted trade-off, documented in the PR body (the repo has no CHANGELOG). Unruled harvey still has the same 35 OK→ERR cases, and two real-font compare cases also fall in this class (w=640, 4 columns, "Interoperability" with a long row name → `too long for 106/107px`).
- m2 (transpose advice for more than 12 columns): resolved. Advice is given only when `rows ≤ 6 && cols ≤ 12`, and both transposed limits then hold. A test pins the 13-column case.

## Findings
### m1 (Minor): the test does not pin the preferred 16px padding for ruled heads
- Evidence: mutation B makes ruled heads skip the `colW - 16` try and use `fit(k, colW - 8, colW - 4, …)` directly (main's behaviour). All 13 compare/harvey tests still pass. The "8px padding" assertion measures the head `B`, which is far narrower than any limit, so it holds under either rule. Behaviour is correct (I read `lib/charts-rating-table.ts:47`).
- Fix: assert the padding on a head whose bold width lies between `colW - 16` and `colW - 8`, or check that a multi-word head wraps at `colW - 16`.

## Checked, no finding
- `tryFit` keeps the kinsoku narrowing loop. `fit` is `tryFit ?? fail`, so the row, corner and note messages are unchanged. The fallback is ruled-only, and unruled heads keep `colW - 8 / colW - 4` as before.
- Long Latin words are not split by `c.wrap`, so a head that cannot meet `colW - 16` cannot "succeed" there by breaking mid-word. It falls back to main's rule.
- Tests run locally: `test/charts-compare.test.ts` + harvey tests: 13 pass, 0 fail. CI on this head (run 45767491339): golden and the test shards were still in progress at review time. Round 2 had golden green, and this commit changes only ruled heads that fail at 16px, which main drew at 8/4.
- Overlap: unchanged from round 2 (#372 reuses `rowW`/`colW`; #480/#484 only regenerate `schema/spec.schema.json`).

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 0)
