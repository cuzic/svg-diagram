# PR #464 review (Opus, round 1)

Target: feat/tree-edge-style @ ec0a7c0b779c5179ac775ea5d05f5f2243b91e36

## Conclusion
The behaviour matches ADR 0081 D1–D3, the focus/dim table, D6 and D8. Trunk grouping is correct for every layout I tried (radial sides, org shared drop, list, left/up mirrors, band-node children, `from` excluded). The own segment is 24px or more in tree `down`/`right`/`auto`, in all seven mindmap layouts, and with `density: 'compact'`. Trees without `edge` give byte-identical SVG (CI golden passes) and PPTX (194/194 example hashes match the merge-base locally). The PR is still not mergeable: CI `test (1/3)` fails on a real cause. The new code pushes three package-bundle budgets over their limits, and because that step aborts the job, shard 1's unit tests and the strict example check never ran in CI. converged: no.

## Previous round
None (round 1).

## Findings
### M1 (Major): CI is red for a real reason: the mindmap and tree bundle budgets are exceeded, and shard 1's tests did not run in CI
- Evidence: `gh run view --job 139181762981 --log` fails in `pnpm build && node scripts/check-package-bundles.ts` with `esbuild: Spec catalog: mindmap が 94000 バイトを超えています (94130)`. I reproduced it locally with the same byte count. With the assert turned into a log line (local only, not committed), three budgets are over: esbuild mindmap 94130 > 94000, Vite mindmap 122611 > 122000, esbuild tree 92259 > 92000 (`scripts/check-package-bundles.ts:161,183`). The merge-base gives 90335 for esbuild mindmap, so this PR adds about 3.8 KB (lib/tree-edge-style.ts plus the Japanese DSL messages in UTF-8). The job stops at that step, so in CI `node --test --test-shard=1/3` and `check-diagram.ts --strict examples/*.ts` never ran. I ran shard 1 locally: 1350 pass and 2 fail. Both failures are in `test/raster.test.ts` (emoji/Japanese system-font tests) and fail the same way on the merge-base, so they depend on the environment. Shards 2 and 3 pass in CI, the golden job passes, and the strict check of the mindmap and tree examples passes locally. Conclusion on the author's 9 local failures: none is caused by this PR's code. The only real failure is the bundle budget.
- Fix: shrink the code in the bundle (shorter messages, fewer exported helpers) or raise the three budgets in `scripts/check-package-bundles.ts` with the measured sizes and a reason in the commit. Then rerun CI so that shard 1's tests and the strict example check actually run.

### m1 (Minor): org: a 2-point child near the root's centre runs beside a styled shared drop
- Evidence: I ran `mindmap({label:'本部', children:[{label:'ア', edge:{line:'dashed'}}, {label:'イ'}, {label:'ウウウウウ', edge:{line:'dashed'}}]}, {layout:'org'})`. The plain middle child gets the 2-point line `(465,56)→(465,102)` (`lib/map-layouts.ts:67`). The group {ア, ウウウウウ} is all dashed, so T = S and the drop `(467.5,56)→(467.5,78)` is drawn dashed, 2.5px from the solid line. The result reads as a smeared, half-dashed trunk. The ADR's "a 2-point line shares nothing" is false in this case: the line runs within 4px of the drop by construction. It matches ADR D2 as written, so it is not a contract violation.
- Fix: count an org root child's 2-point line as a member of the root-children group when deciding T (or record it as an ADR follow-up).

### m2 (Minor): test gaps: three key rules survive mutation
- Evidence: each mutation below leaves `test/tree-edge-style.test.ts` and `test/tree.test.ts` at 0 failures (applied locally, reverted):
  1. `lib/pptx/tree.ts:69`: back to the old `lit`-only sort, so the PPTX draw order (default → styled → lit, D2) is untested.
  2. `lib/tree-edge-style.ts:65`: drop `focused && !e.lit ? DEFAULT_EDGE :`. In a focus tree where every unlit sibling is dashed, the table's "muted solid trunk" rule is untested.
  3. `lib/emit-tree.ts:23`: drop `|| e.curve || e.points.length < 3`. A curved or 2-point dashed line in a focus or dim tree would then be drawn as a straight stub. Nothing checks this.
- Fix: add one assertion for each (PPTX shape order with a styled and a plain sibling; a focus tree with all-dashed unlit siblings giving two paths; `edges: 'curve'` plus focus or dim with a dashed edge giving one `C` path).

### m3 (Minor): `examples/out/pptx-golden.json` has no entry for the new example, so the D8 PPTX check fails as specified
- Evidence: `test/helpers/pptx/golden.ts` exits 1 on `new (not in the manifest): mindmap-branch-style`. So `gh workflow run pptx-golden.yml -f update=false` (ADR D8) reports a failure even though every existing hash is unchanged (verified locally, 194/194).
- Fix: run the workflow with `update=true` on this branch and commit the one added hash.

### m4 (Minor): unknown keys in `edge` are silently ignored
- Evidence: `tree({label:'r', children:[{label:'a', edge:{color:'red'}}]})` does not throw and draws a plain line (`lib/dsl/tree.ts:46-54` checks only `tone` and `line`). A user who writes `color` (or `style`, or `dash`) gets the default line with no message.
- Fix: reject keys other than `tone` and `line` with the same one-line "what is wrong / how to fix" message.

### n1 (nit): the JSDoc of `focusTree` now documents `EDGE_TONES`
- Evidence: `lib/dsl/tree.ts:15-21`. The new `const EDGE_TONES … EDGE_LINES` sits between the `/** … */` block and `function focusTree`.
- Fix: move the constants above the comment.

### n2 (nit): wording
- Evidence: from `mindmap()`, the root-edge, shape, tone and line errors start with `tree():`, because they are thrown inside the delegated `tree()`. The README paragraph now says "例は `examples/mindmap-branch-style.ts`。例は `examples/mindmap.ts`…" (two sentences starting "例は").
- Fix: pass the caller name through, or accept it; merge the two "例は" sentences.

Note on other open PRs: #465 (ADR 0081 U2, based on `main`) edits the same files (`lib/tree.ts`, `lib/emit-tree.ts`, `lib/pptx/tree.ts`, `lib/dsl/tree.ts`, `lib/types/diagrams.ts`) and also grows the mindmap and tree bundles. Expect conflicts and a second budget bump in whichever PR merges second.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 4 / nit 2)
