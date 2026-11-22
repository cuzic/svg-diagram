# Review of PR #437 (ADR 0075 U1), round 1, head 8d40e050

Method: throwaway worktrees of the PR and of main (23e43e16). I read the diff line by line against ADR 0075 (D1-D5, U1, the U1 implementation notes), re-ran the measurements, ran the new and changed tests, and ran my own mutations.

Privacy: **no user-figure wording and no report path** in the PR diff, the ADR note, the scripts or the PR body. `CRT_REPORT_*` is the existing synthetic fixture. `REPORT_CRT` appears only in the pre-existing comments of `scripts/crt-u6-measure/fixture.ts`. No Blocker on that count.

## Summary

The algorithm and integration conform to the accepted ADR and reproduce its numbers exactly. Two Majors: CI is red because of a lint error the PR introduces (and the PR body states the opposite), and the new tests leave the ADR's own scope and guard tests partly unwritten (a mutation that makes `whyWhyTree` bands run the row search survives the whole suite). The minText 10 question is an owner decision; my recommendation is to accept it with a tighter pin.

## 1. Conformance to ADR 0075

| ADR item | Code | Verdict |
|---|---|---|
| D1: restarts 5, moves 3000, T 2 to 0.05 geometric, seed 7, LCG, shared stream, restart 0 unshuffled, Fisher-Yates then stable sort by component, strict best update, stop at 0, weight 6 both branches, sift (degree order, nearer, right first, 8 passes) | `lib/layer-order-search.ts` | Matches the ADR line by line, and the numbers match the prototype exactly (same moves 1,178,736 / 752,437, same hashes). |
| D2: first search in the first `layoutLayered` call of `base`; loop untouched; candidates after the loop; forecast `p1 < bestProxy + 1` with the AND exemption `bestScore[0] > 0`; `post` only with a `bestOrder`; last-call `took`; refused force is no candidate | `lib/toc.ts` 135-200, `lib/graph-layout.ts` 527-534 | Conforms. The `post` condition uses the live `bestOrder` (cleared when the first rows candidate wins), which the ADR's U1 note documents as the measured behaviour. The ADR body text (D2 line 50) still reads differently; the note is the authority. OK. |
| D3: M = main's pick built exactly as main (`pickFinal(first, [foundMain, mainPick.t])`); R = best rows candidate with each candidate checked first; R replaces M only if the ADR 0073 window over [M, R] selects it | `pickTwoStage` | Conforms (this is the round-3 fix of the ADR review). |
| D4: pool-stage overlap guard (strict `>`), final overlap guard `ov(R) <= ov(M)` | `tryRows`, `pickTwoStage` | Conforms. By construction the final figure is M or R, so the final overlap bound holds. |
| D5: `layouts` counter in `once`, per-figure +4, total +30%, moves | `searchStats`, `test/cause-layer-order*.test.ts` | Conforms. |
| U1: no globals for the search; `LO` and `why*` stats not carried | `rowSearch` / `forceRows` via options; `searchHooks` is a new module-level global for tests | Conforms for the search state. `searchHooks.onReplace` is a mutable exported global used by production code paths (the callback is only evaluated when set). See Nit N1. |
| Other diagram types byte-identical | the hooks run only when `opts.rowSearch` / `forceRows` are given, which only `toc.ts` passes | Holds by construction; CI golden passes; `fixture.ts` shows the 19 runnable fixture / `toc-*` figures identical to main. |

## 2. Reproduction

| Item | Result |
|---|---|
| Quality (286 plain / 150 canvas random CRTs) | **Exact:** crossings 571>458, 359>291; `cause-crossing` 51>40, 33>25 (none up); bends +0.2% / +0.6%; pairs 81>76, 56>50; overlaps 14>12, 5>3 (none up); crossings up only #147, #162 / #147 (AND 1>0); changed 64 / 41; moves 1,178,736 / 752,437. |
| Layouts | From the pins file (`main` column) and my PR run: 4057>4533 (+11.7%), 2385>2650 (+11.1%), max +4 per figure. |
| 20 protected figures | 19 runnable here (7 `fix-*`, 12 `toc-*`; the report figure needs `REPORT_CRT`): hashes identical to main. CI golden check: **pass** (golden diff 0). |
| Tests | New and changed files (`layer-order-search`, `cause-layer-order`, `cause-layer-order-cost`, `pick-final-two-stage`, `cause-order-pins`, `cause-order-search`, `crt-canvas-scale`): 58/58 pass. Full suite: 3255 pass, 8 fail; the same 8 fail with the PR's own code unmodified, and they are environment failures (emoji font, Chromium, system fonts, example lint budget), as the author says. |
| `pnpm typecheck` | OK. |
| CI | golden pass, test 2/3 pass, 3/3 pass, **test 1/3 fails at `pnpm lint`** (see M1). |

## 3. Findings

### M1 (Major): `pnpm lint` fails with 1 error that the PR introduces; CI shard 1 is red, and the PR body says otherwise

- Location: `lib/toc.ts:189` (`bestScore[0]! > 0`: `lint/style/noNonNullAssertion`, error level).
- Main (23e43e16): `pnpm lint` = **0 errors**, 26 warnings, 13 infos. PR: **1 error**, 26 warnings, 14 infos (the extra info is `lib/layer-order-search.ts:92`, `Math.pow`). CI job `test (1/3)` runs `pnpm lint` (`.github/workflows/test.yml:43`) and fails with `Found 1 error`.
- The PR body says "pnpm lint 全体は main の最新で別の 71 件の errors". I could not reproduce that: main has no errors. The 71 do not exist on current main, and the one error is in the PR's own file.
- Fix: `(bestScore[0] ?? 0) > 0` (the rest of the file avoids `!` the same way); optionally `**` for `Math.pow`. Correct the PR text.

### M2 (Major): the ADR's U1 test list is only partly implemented; mutations that change the accepted scope survive

Location: `test/layer-order-search.test.ts` (last test), `test/cause-layer-order.test.ts`; ADR U1 tests 3, 4, 5.

My mutations, each run against the seven test files above (the first also against the whole suite):

| Mutation | Result |
|---|---|
| **A.** `rowSearchOn = band.straighten !== false` (drop `band.layerFrom === undefined`, so `whyWhyTree` bands run the row search) | **Survives the full suite** (identical 8 environment failures). It changes the output of **25 of 150** `whyWhyTree`-band figures (188 searches). ADR 0075 scope and U1 test 5 say `layerFrom` bands must not change. |
| **B.** drop the `inFrame` check in `tryRows` | Survives (48/48 pass). |
| **C.** drop the pool-stage overlap guard in `tryRows` | Survives. ADR U1 test 3 asks for both the pool stage and the final stage. |
| **D.** drop the refusal `!force.took` in `tryRows` | Survives. ADR U1 test 4 asks for "a refused force is not a candidate" at the `toc` level; only the `layoutLayered` hook is tested. |
| E. drop the final overlap guard in `pickTwoStage` (author's) | Caught (1 failure). |
| F. drop the AND exemption (author's) | Caught (3 failures). |

- Not caught means a future change can silently change `whyWhyTree` figures (A), or break three defensive paths (B-D). B and D are defensive paths that never trigger in the 450-figure sample (refusal 0, frame rejections 0), and C is covered at the final stage only.
- Fix:
  - A: add a test that a `layerFrom: 'effect'` band and a `band.base` band do not search (`searchStats.rowSearches` unchanged, or the edges equal the unsearched ones) on a figure that crosses (plain #1 is used by the existing test).
  - B/C/D: add small `layoutCauseBand`-level tests with constructed figures, or a unit test of the candidate gate extracted as a function, so each guard has a case where it is the only thing that rejects.

### Q3 (owner decision, answered): the minText 10 report-shaped fixture

Measured on main and on the PR (same fixture, canvas 2600x2000, `crtFigure({minText})`):

| minText | main | PR |
|---|---|---|
| 10 | crossings 8, cause-crossing 2, bends 66, min side-by-side spacing 14, pairs@14 0 | crossings 7, cause-crossing 1, bends 52, **min spacing 10, pairs@14 1** |
| 14 / 18 / 24 | 5 / 0 / 52 (pairs 0) | identical to main |

- Consistency with ADR 0075 Q1 / P3 (pairs may rise where crossings or AND crossings fall): **yes**. The crossings and `cause-crossing` fall and the change is within the accepted rule.
- Consistency with ADR 0070: the pairs-0 criterion is stated for the fixture set that ADR 0075 measured (default, asap, wide, compact, no canvas, minText 14 / 24, `toc-*`, report), and all of those are unchanged. minText 10 was never in it. But `crt-canvas-scale.test.ts` states a stronger D7 invariant for small text ("keeps today's spacing, s >= 1": spacing >= `laneStepOf(1)` = 14), which this figure now breaks (10 < 14). Note that main already misses the 0070 cause-crossing criterion there (2, not 0).
- The relaxation is too loose as written: `fewer = minText === 10 && crossingsOf(...) < 8` skips both the spacing assertion and the no-pairs assertion, so any spacing regression passes at minText 10 as long as crossings stay below 8.
- **Recommendation: accept the change (it removes a cause-crossing warning and 14 bends for one 10px pair), but pin it exactly instead of relaxing it**, and record the owner's confirmation in ADR 0070:
  - for minText 10 assert crossings === 7, cause-crossing === 1, bends <= 52, pairs@14 <= 1, min spacing >= 10 (any other change must be a deliberate update); keep the strict assertions for 14;
  - write the exception into ADR 0070 (a note under the pairs-0 criterion: minText 10, one pair at 10px accepted by the owner), and update the stale code comment that refers to "the PR's Open questions".
- Alternative if the owner wants pairs 0 absolute: do not special-case the figure (that would be a name list, which ADR 0073 forbids). Use a general final-stage filter "R may not raise the pairs at the figure's lane step". ADR 0075's own measured variant of this filter cost about 2.2 / 0.8 points of crossing reduction and left `cause-crossing` unchanged (51>42, 33>26). I do not recommend it, since the owner already accepted Q1 on this trade.

### Test edits: legitimate, with one weakening

- **`test/cause-order-search.test.ts` whyWhyTree test moved from #53 to #101: legitimate and not weakened.**
  - #53 no longer has the premise (with the row search, causeTree #53 reaches 0 crossings with and without the exchange flag).
  - #101 still has it (6 vs 16 crossings).
  - I ran the mutation "remove the `own` declaration" (`const own = true`): the edited test fails (1 failure), and the set of `whyWhyTree` bands that differ by the flag is still the same 13 figures (#28 #37 #42 #50 #53 #90 #92 #101 #108 #124 #130 #137 #149), because those bands do not use the row search.
  - The edited comment is misleading: it says the flag matters for "#101 and #130 only; before, 13 figures". The 13 is the whyWhyTree-under-mutation set, which did not shrink. On causeTree bands the flag still changes crossings for 11 figures on the PR (0, 70, 71, 75, 86, 101, 106, 116, 130, 132, 134; main: 9). Fix the comment.
- **The exchange loop test drops #101's "taller" premise: a weakening, easily avoided.** The final pick for #101 is a rows candidate at height 704.5 (below base 705.75; seeded by the taller order that the loop adopted), so the loop's taller adoption is no longer visible in `on.h`. The other four figures keep the premise. Fix: keep #101 in the crossing assertion but add figure **#130** (on 683.75 > base 637.25, crossings 4 vs 6) to the list so five figures still assert the taller-order premise.

### m1 (Minor): the measurement script cannot reproduce the layout gate against a plain main worktree

- `scripts/crt-u6-measure/lo-compare.mjs` / `lo-run.sh`: the base run reads `rows[4]` (layouts), which main does not emit, so the output is `layouts 0>4533 (Infinity%) ... layouts FAIL` when the documented workflow (a worktree of main for the base) is used. The author's numbers come from the pins file's `main` column.
- Fix: read the base layouts from `crt-layer-order-pins.json` (or add a one-line counter patch step to the instructions), and say so in the script header.

### m2 (Minor): the old pins' P3 baseline is #406-era main

- `test/cause-order-pins.test.ts`: `x.c < m[1] || x.and < m[3]` compares with the `main` row of `crt-random-pins.json`, which is the pre-ADR-0073 baseline. Crossings that fell because of earlier ADRs make the P3 exception easier to satisfy here. The accurate check against current main is in `cause-layer-order.test.ts`, so there is no hole, but say it in the comment.
- I checked the `now` row changes (25 rows plus new rows): every worsened value (bends, pairs, height, one crossing) comes with a fall in crossings or AND crossings, so the ratchet was not loosened without cause (largest: canvas #0, height 495>593 for one crossing).

### N1-N3 (Nit)

- N1: `searchHooks` (a mutable exported object read in production code) is a global; the PR text says "グローバルは持たない". Say it is a test hook, or pass the callback through the env object instead.
- N2: `rowSearch` / `forceRows` are output parameters written into the caller's option objects (`result`, `took`). Documented in the type comments; fine, but the first call that "has no result yet" is stateful. Keep the doc comments in sync if the options are ever reused across figures.
- N3: `lib/layer-order-search.ts:92` `Math.pow` (info-level lint, auto-fixable).

## Checks done without findings

- The hook in `layoutLayered` runs after the sweeps and before the `orderOnly` return; `orderOnly` calls never search or force.
- `forceRows` sets `took` on every call, so "the last call took it" holds; refusal leaves the sweeps' order.
- The second search is a fresh `search2` object, so it cannot reuse the first result.
- `rowsWon` / `foundRows` logic follows the ADR: no second search when the first candidate won (documented), candidates dropped when the force is refused.
- `pickTwoStage`: the R pool filters each candidate first (round-3 minor fixed), so an out-of-frame candidate cannot seed it; tests cover it.

## Verdict: MAJORS (M1, M2). No Blockers.

M1 is a one-line fix and must land before merge (CI is red). M2 needs the missing tests (at least A, the `layerFrom` / `band.base` scope test, because it guards a behaviour change for another diagram type). The minText 10 relaxation can merge once pinned exactly and the owner's confirmation is recorded; my recommendation is to accept it. After M1/M2 and the test-edit and comment fixes, I would accept.

Cleanup: both throwaway worktrees and the branch are removed.
