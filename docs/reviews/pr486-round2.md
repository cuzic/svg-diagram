# PR #486 review (Opus, round 2)

Target: fix/label-overlaps-c5-c6 @ b23e63b1d6ec164291961638f6eb034e711b7d5b

## Conclusion
All seven round 1 findings are fixed, and I checked each one by running it. CI is green on the head. Merged with the current main (5190b577, which is ahead of the PR's merge base), the bundle check also passes. In sweeps of flowchart, stateDiagram, decisionLadder and both BPMN directions, no figure that main drew clean gains a problem, and the vertical BPMN stack is gone. The figures it affected used to have stacked chips; they now mostly have a chip on a task box, which `check` still reports (m2). converged: yes.

## Previous round
- M1 resolved: CI on b23e63b1 is all green (`test (1/3)`, `(2/3)`, `(3/3)`, golden). I also merged origin/main 5190b577 locally (#480 landed after the PR's merge base) and ran `tsc` + `scripts/check-package-bundles.ts`, which exits 0. Spec catalog: mindmap is 99603/128884 bytes against 99610/128900, and tree is 95845/124925 against 95860/124990 (see m1).
- M2 resolved (the stack): on the round 1 repro the chips are now at y=299 and y=326, with no label-on-label overlap at width 754 or 900. Mutation: going back to weight 1 makes both new `dir 'v'` tests fail.
- M3 resolved: `validateSpec` accepts `maxNodeW: 'auto'` and `160`. `renderSpec` with `'auto'` gives `auto-fit-applied` info (200→150), and leaving it out gives the warn, whose advice can now be followed on the JSON path.
- m1 resolved: in the dense sweep (700 flowcharts + 700 state diagrams), no figure gains `runs outside the figure`.
- m2 resolved: `tree(…, {maxNodeW: 'auto'})` throws exactly `tree(): maxNodeW must be a number >= 80 (got auto)`. The test now calls `tree()`.
- n1 resolved: `lib/tree.ts:168` no longer passes `'auto'` as `maxNodeW`.
- n2 resolved: `auto-layout.md` and the `auto-fit-applied` doc now mention mindmap / `maxNodeW: 'auto'`, and `config.schema.json` was regenerated.

## Findings

### m1 (Minor): the raised budgets leave 7 and 15 bytes on the merge with current main, but the file says "measured + about 200 bytes"
- Evidence (ran): main 5190b577 alone measures mindmap 99281 and tree 95544 (esbuild). The PR merged into it measures 99603 and 95845, which is +322 and +301 bytes. The budgets were raised by +210 and +160, which leaves 7 bytes (mindmap esbuild) and 15 bytes (tree esbuild). The comment at `scripts/check-package-bundles.ts:124`, which comes from main (ADR 0081), says these two are "measured + about 200 bytes". The next main change on the tree/spec-kit path will turn CI red on an unrelated PR, as happened in round 1.
- Fix: the parent accepted a minimal raise. If it stays, add a note in the PR. Otherwise set the budgets to the merged measurement + ~200 (esbuild mindmap ≈ 99800 / tree ≈ 96050, Vite ≈ 129100 / 125130) so that they match the comment.

### m2 (Minor): vertical BPMN trades stacked chips for chips on task boxes; the C6a repro still has 2 problems, and its test only asserts "no label-on-label"
- Evidence (ran `bpmn2.ts`, 800 random `dir: 'v'` figures, main 5190b577 vs head):
  - Figures with stacked chips: 160 → 7.
  - Clean figures: 312 → 315. No figure that main drew clean has a problem.
  - Total problems: 1489 → 1609. "the text … overlaps <node>": 334 → 447.
  - Among the 154 changed figures, 107 have more problems, 10 fewer and 37 the same.
  - 3 figures gain `flow … runs through "tN"` and 1 loses it. A chip is an obstacle for the flows routed after it.
  - On the round 1 repro itself, `上限を超える場合` now sits on `t2` (`the text … overlaps "t2"` + `label … overlaps "t2"`) instead of on the other chip.
  - `test/label-overlaps-crowded.test.ts:72` asserts only `!/overlaps label/`, so the remaining overlap is not covered.
  - Horizontal BPMN: 600 figures, 0 changed.
  - Every one of these problems is reported by `check`, so the change is never silent, and it fixes the stacking the PR set out to fix.
- Fix: say in the PR text that the vertical repro still has a chip on a task box. Open a follow-up issue with the repro, for example to add spots in the vertical placer `chipSpot` (`lib/bpmn-vertical.ts:240`) further along the flow or on the far side of the target, so that the chip finds a free spot.

### m3 (Minor): the out-of-band term (round 1 m1) has no test
- Evidence (ran): with `+ (bx.x < out.x || … ? 5 : 0)` removed from `lib/states.ts:186`, `test/label-overlaps-crowded.test.ts`, `test/states*.test.ts` and `test/flowchart*.test.ts` all pass (44/44). The behaviour is correct (see the previous round).
- Fix: add one crowded flowchart where the least-crowded spot is outside the band, and assert that no label `runs outside the figure`.

### n1 (nit): the spec schema's `'auto'` branch has no description, and the integer branch still says "in px"
- Judgement: acceptable as it is. The warn message says when to write `'auto'`, and a description costs bytes against a budget with 7 bytes of margin (m1). If m1 raises the budgets, a short description on the outer `maxNodeW` is worth the ~80 bytes for MCP and JSON authors, for example "px (120–400), or 'auto' to find the widest that fits (info)".

### n2 (nit): a wrong spec value names only one of the two options
- Evidence (ran): `maxNodeW: 'wide'` gives `must be one of "auto" (got "wide")`, which does not mention the number option. `50` gives `must be between 120 and 400`, which does not mention `'auto'`. This is how the generic `oneOf` reports errors, so the fix is optional.

### n3 (nit): the top of the PR body is out of date
- The "テスト" section and the Open questions still say that the spec has no `'auto'`, that the budgets were not raised, and that C6a/C6b did not reproduce. Only the "round 1 の対応" table is current. Update the top section.

## Checks that passed
- Sweeps, main 5190b577 against the head, same seeds:
  - Normal sweep, 600 each of flowchart / stateDiagram / decisionLadder: flowchart 0 changed; state 1 changed, which removed a stack; ladder 0 changed.
  - Dense sweep, 700 flowcharts + 700 state diagrams: stacked labels 85→0 and 17→0. Total problems 1380→1312 and 336→297. The out-of-band and astray counts are unchanged. No figure that main drew clean has a problem.
  - Horizontal BPMN, 600 figures: unchanged.
- The mindmap `'auto'` re-run (all 10 layouts, keepWords, determinism, too-narrow throws, `'Auto'`/`NaN` rejected) gives the same results as round 1.
- Targeted tests: `test/mindmap-auto-width.test.ts` and `test/label-overlaps-crowded.test.ts` pass 12/12.
- Other open PRs: #484 touches `schema/spec.schema.json` and #479 touches `schema/config.schema.json`. Both files are generated, so a merge conflict there needs `pnpm schema` again, not a hand merge. #487 does not touch the files this PR changes.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 3 / nit 3)
