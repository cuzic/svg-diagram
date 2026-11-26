# PR #486 review (Opus, round 1)

Target: fix/label-overlaps-c5-c6 @ ade6e7572c3fa330b3f4f6d34aa4e5b989517378

## Conclusion
The two code changes do what they say. The C6 fallback in `lib/states.ts` removed every label-on-label stack in a 1,300-figure sweep. No figure that main drew clean gained a problem, and `decisionLadder` did not change at all. `mindmap({maxNodeW: 'auto'})` is deterministic and gives an info note. Three Majors block the merge. (1) CI is red: on the merge ref the mindmap spec bundle is 7 bytes over its esbuild budget. (2) C6a does reproduce, in vertical BPMN (`dir: 'v'`), so the PR's "not reproduced" is wrong. (3) On the JSON spec / MCP path, the new warning tells the author to write `maxNodeW: 'auto'`, and the schema rejects that value. converged: no.

## Previous round
n/a (round 1)

## Findings

### M1 (Major): CI `test (1/3)` fails: `Spec catalog: mindmap` is over its esbuild budget on the merge ref
- Evidence (read CI run 45769285475, job test (1/3)): `AssertionError: esbuild: Spec catalog: mindmap が 99400 バイトを超えています (99407)` at `scripts/check-package-bundles.ts:1230`. Main @6b0c6252 is green. The PR head alone passes: I ran `pnpm build && node scripts/check-package-bundles.ts` locally and got esbuild 99362 / Vite 128695, which is 38 and 5 bytes of margin. The roughly 45 bytes that main added since the base 3d48d63f push the merged result over the limit. The margin the PR description reports ("0 to a few bytes") was already too small to survive any merge.
- Fix: merge origin/main. Then either trim bytes on the mindmap spec path or raise the `mindmap` budget explicitly, with a note in the PR. The budget raise is the owner's call, and M3 needs it anyway.

### M2 (Major): C6a reproduces: in a vertical BPMN, two labelled exits of one gateway are stacked on each other
- Evidence (ran, on PR head and on base 3d48d63f, same output, so the bug predates this PR): a random search over 800 BPMN figures (1–3 gateways, 2–4 labelled exits, labels up to 12 characters, width 700–1800, `h`, `h` + `fit: 'shrink'` and `v`) found 46 figures with stacked chips. All 46 are `dir: 'v'`, and 49 of the 50 stacked pairs are exits of the same gateway. None are in `h`, which is the only direction the PR tried. Minimal repro (invented wording):
  ```ts
  const lanes = [{id: 'a', label: '申請者'}, {id: 'b', label: '審査'}, {id: 'c', label: '経理'}, {id: 'd', label: '部長'}];
  const nodes = [{id: 'st', lane: 'a', kind: 'start', label: '開始'}, {id: 't0', lane: 'd', label: '内容を見る'}, {id: 'g0', lane: 'd', kind: 'and', label: '判定'},
    {id: 't1', lane: 'c', label: '支払いの手続きをする'}, {id: 't2', lane: 'd', label: '決裁する'}, {id: 'en', lane: 'a', kind: 'end', label: '終了'}];
  const flows = [{from: 'st', to: 't0'}, {from: 't0', to: 'g0'}, {from: 'g0', to: 't1', label: '上限以内の場合'}, {from: 'g0', to: 't2', label: '上限を超える場合'}, {from: 't1', to: 'en'}];
  diagram({theme: 'blue', width: 754}).add(bpmn(lanes, nodes, flows, {dir: 'v'}));
  ```
  Both chips land at y=299 (x 527 w108 and x 549 w122), 86x22px on top of each other. `check` reports it (`label "上限以内の場合" overlaps label "上限を超える場合" by 86x22px`, plus `sits on the flow g0 -> t1`), so the overlap is not silent. The same happens at width 900. With はい/いいえ, or 承認する/差し戻す場合, the chips do not stack.
- Cause (read): `lib/bpmn-vertical.ts` `chipSpot` / `placeChip` (around lines 230–276) is a separate placer from the horizontal `chip()` in `lib/bpmn.ts`. Its fallback does not keep a chip off the gateway's other chips.
- Fix: in the vertical placer, apply the same rule this PR applies in `lib/states.ts`: when no spot is clear, count a chip on another chip most heavily. Turn the repro above into a regression test in `test/label-overlaps-crowded.test.ts`, which today only covers `dir: 'h'`. If the owner prefers to keep this PR narrow, a follow-up issue with this repro is acceptable, but the PR text must stop saying that C6a does not reproduce.

### M3 (Major): on the JSON spec / MCP path, the new warning tells the author to write `maxNodeW: 'auto'`, which the spec schema rejects
- Evidence (ran `renderSpec` from `lib/spec-render.ts`): a spec `{version: 1, width: 900, parts: [{type: 'mindmap', root: <8 branches of 12 characters>}]}` returns the warn `tree() / mindmap(): maxNodeW を省略したため…。意図した変更なら maxNodeW: 'auto' と書く（info になる）`. The same spec with `maxNodeW: 'auto'` is rejected: `parts[0].maxNodeW: must be an integer (got "auto")` (`MAX_NODE_WIDTH` in `lib/spec-kit.ts:86`). ChatGPT, Copilot and the VS Code spec users all build figures this way, so the advice they get cannot be followed. The old text (`dir: 'auto'`) was also wrong for them, but the point of C5 is to make this message right.
- Fix (preferred): accept `'auto'` in the mindmap spec part (`maxNodeW: {oneOf: [MAX_NODE_WIDTH, {const: 'auto'}]}` or similar) and raise the budget together with M1. Otherwise, make the message valid on both paths, for example: "意図した変更なら maxNodeW: 'auto'（DSL）か、収まる幅を数値で書く（例 maxNodeW: 130）".

### m1 (Minor): the new fallback has no cost for leaving the band, so a label can be moved outside the figure
- Evidence (ran): in a dense sweep of 700 flowcharts and 700 state diagrams (5–12 nodes, 1.2–2.5 extra edges per node, 95% of edges labelled with up to 10 characters), 103 figures changed. The label-label overlaps went from 126 to 0 and the label-on-node overlaps from 4 to 0. In one figure (flowchart #69: 11 nodes, 28 edges, `dir: 'down'`, width 622), a label that main left overlapping another label is now placed `runs outside the figure`. `check` reports this. `crowd()` in `lib/states.ts:186` counts labels, nodes, the arrowhead and other arrows, but not the band's bounds. The BPMN `chip()` adds `+5` for that case.
- Fix: add a term for a box outside the band, weighted above a label-label overlap, for example `+5` as BPMN does.

### m2 (Minor): `tree()` rejects `'auto'` with a message that offers `'auto'`
- Evidence (ran): `tree(root, {maxNodeW: 'auto'})` throws `tree(): maxNodeW must be >= 80 or 'auto' (got auto)` (`lib/dsl/tree.ts:56`).
- Fix: only mention `'auto'` when `who === 'mindmap()'`. For `tree()`, keep "must be a number >= 80". The test at `test/mindmap-auto-width.test.ts:40` only checks for `/maxNodeW/`.

### n1 (nit): `lib/tree.ts:168` passes `'auto'` into the plan's `maxNodeW` (`band.maxNodeW as number`)
- Every current read of `plan.maxNodeW` in `lib/fit-width.ts` is guarded by `autoWidth`, so the output is correct today. `lib/toc.ts:466` drops `'auto'` before passing it; do the same here so a later read of `plan.maxNodeW` cannot see a string.

### n2 (nit): docs
- `skills/svg-diagram/references/auto-layout.md` says, for mindmap, "`dir` / `maxNodeW` を省くと warn", but a mindmap has no `dir`.
- The rule doc of `auto-fit-applied` (`lib/verify-layout-fit.ts:7`) still lists only `dir` / `dir: 'auto'` and does not mention mindmap `maxNodeW: 'auto'`.

## Checks that passed
- No changed figure got worse. Base 3d48d63f against the head, with the same seeds:
  - Normal sweep (600 each of flowchart / stateDiagram / decisionLadder): 1 figure changed, and the change removed a stack.
  - Dense sweep: 103 figures changed. No figure that base drew with 0 problems has a problem now. The "label is far from its own arrow" count is unchanged (543 → 542).
- `decisionLadder` is unaffected. No layout changed in 600 default figures, nor in 400 figures with long yes/no words of 4–14 characters at width 420–1000.
- CI golden passes. The new regression test fails on base (`flowchart: in a crowded figure…`) and passes on the head. Both new test files pass (9/9).
- `maxNodeW: 'auto'` on mindmap behaves as intended:
  - The same input gives the same output (radial, 10×15 characters, 200→180 twice).
  - It also works with `keepWords: true` (200→110, info).
  - For every layout that does not fit at 860px (down / org / fishbone / timeline), it throws with the tried list, as before.
  - `'Auto'` and `NaN` are rejected.
- Only this PR touches these files (`gh pr list`).

## Open questions (recommendations)
1. **Label weighting (label > node = arrowhead > other arrow):** agree. Add the out-of-band term from m1, above a label-label overlap.
2. **Cap mindmap `'auto'` at 200?** Keep 260 (ADR 0019 D2, the same as fta / causeTree), so that one knob means one thing. Side note: on a roomy figure, `'auto'` reports `maxNodeW を 200→260 に広げた(568→568px)` even though nothing visibly changes. This is the existing D2 behaviour for every part; it is not a reason to cap only the mindmap.
3. **`'auto'` in the JSON spec:** add it (M3) and raise the mindmap budget once, together with M1. Otherwise the warning advertises a value the MCP path cannot send.
4. **BPMN C6a:** it reproduces in `dir: 'v'` (M2). Fix it here, or split it out with the repro above as a test. Either way, update the PR text.

## Verdict
converged: no (Blocker 0 / Major 3 / Minor 2 / nit 2)
