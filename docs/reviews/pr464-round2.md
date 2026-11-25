# PR #464 review (Opus, round 2)

Target: feat/tree-edge-style @ 8fa7646ca84b64783e091037f3b6c9d16d48e7c6

## Conclusion
Every round-1 finding is fixed, and I checked each one by behaviour, not by the commit message. CI is fully green. Shard 1 now runs its tests (1356 tests, 0 fail) and the strict example check. The three raised budgets equal the measured sizes plus 150 to 230 bytes, so they are not inflated. Trees without `edge` still take the old code path: `bus` is passed only when `hasStyledEdge`, the SVG golden passes, and the PPTX golden for the mindmap, org and tree examples matches. Some `mindmap()` DSL errors now start with `mindmap():` instead of `tree():`. No test, README or skill text quotes the old prefix. The new findings are one cosmetic Minor and two nits. converged: yes.

## Previous round
- M1 resolved: in CI, `test (1/3)` logs `esbuild: Spec catalog: mindmap: 94409 bytes` (budget 94600), `Vite … mindmap: 122850` (123000) and `esbuild … tree: 92570` (92800). It then runs `# tests 1356 / # fail 0` and `check-diagram.ts --strict examples/*.ts`. All 4 checks pass.
- m1 resolved: I re-ran the round-1 input (`本部` with dashed ア and ウウウウウ, plain イ, `layout: 'org'`). イ is now `(453.5,56)→(453.5,78)→(451,78)→(451,102)`. It joins the root group, the group's T is default solid, and no dashed drop runs beside a solid line. The same tree without `edge` still gives イ the 2-point line `(456,56)→(456,100)`.
- m2 resolved: each mutation now fails at least one test. The three are the PPTX sort back to `lit`-only, dropping `focused && !e.lit ? DEFAULT_EDGE :`, and dropping `e.points.length < 3` in `lib/emit-tree.ts:23`. Dropping only `e.curve` survives. That mutation is equivalent, because curve lines are always 2 points (`lib/tree.ts:132`), so the length guard already covers them.
- m3 resolved: the manifest diff against the merge-base (parsed as JSON) changes one key, `mindmap-branch-style`. `comic-faces` only moved to a new position and keeps the same hash. Locally, `node test/helpers/pptx/golden.ts examples/mindmap*.ts examples/org*.ts examples/tree*.ts` reports "12 slides match the manifest". The example uses `layout: 'right'`, so the round-1 org change cannot affect its hash.
- m4 resolved: `edge: {color: 'red'}` throws `tree(): "a" の edge に color は書けません。使えるのは tone と line だけです…` (one line). From `mindmap()` the message starts with `mindmap():`. Removing the check makes the new test fail.
- n1 resolved for `focusTree`: its JSDoc is attached again. See n2 below for the `tree()` JSDoc.
- n2 resolved for DSL-time errors (they now say `mindmap():`), and the README "例は" sentences are merged. Layout-time errors still say `tree():`; see n1 below.

## Findings
### m1 (Minor): in an org tree with any `edge`, a root child 1-4px off the root's centre now gets a 1-4px step, even when no root child is styled
- Evidence: `lib/map-layouts.ts:67`, with `bus: true` from `lib/tree.ts:131` whenever `hasStyledEdge(items)`. I tested `edge` only on a grandchild (`ウウウウウ > x`). The middle root child イ is then drawn `(453.5,78)→(451,78)→(451,102)`, a 2.5px notch in a plain line. That notch is exactly what the 2-point shortcut existed to avoid (see the comment on `:66`). In this case no root child has `edge`, so the root group's T is default either way, and the 2-point line could not have caused the round-1 problem. ADR D2 as edited ("`edge` が 1 つでもある木は根の子を常に 4 点") allows this, so it is not a contract violation.
- Fix: force the bus only when some child of the root has `edge` (the only case where the shared drop can be styled), or state the small step in ADR D2 as accepted.

### n1 (nit): layout-time errors from `mindmap()` still start with `tree():`
- Evidence: `mindmap({label:'r', children:[{label:'a', id:'q'}, {label:'b', id:'q'}]})` throws `tree(): duplicate node id "q"` (`lib/tree.ts:86-87,105`, `lib/layout-tree.ts:84,94,99`). In contrast, `mindmap({label:'r', children:[{label:'a', tone:'bogus'}]})` now says `mindmap(): …`. So one input can start with either prefix, depending on which stage throws.
- Fix: use `band.balanced ? 'mindmap()' : 'tree()'` for these too (as `lib/tree.ts:143` already does), or leave them as they are.

### n2 (nit): the `tree()` JSDoc now sits on `EDGE_TONES`
- Evidence: `lib/dsl/tree.ts:9-15`. The "An org chart / hierarchy …" block is followed by `const EDGE_TONES …`, so the comment documents the constant. On `main` this block was already orphaned (it was followed directly by the `focusTree` JSDoc), so the problem predates this PR.
- Fix: move that block down to sit directly above the `export function tree` overloads.

Other open PRs: #465 (ADR 0081 U2) still edits `lib/dsl/tree.ts`, `lib/tree.ts` and the same bundle budgets. The `treeBand(…, who)` refactor will conflict with its `tree()` checks, so whichever PR merges second needs a rebase-by-merge and another budget bump.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 2)
