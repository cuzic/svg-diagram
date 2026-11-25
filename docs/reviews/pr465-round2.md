# PR #465 review (Opus, round 2)

Target: feat/tree-tags @ b18922a2e6011930b8cc28e7f7948958c1ff0e06

## Conclusion
The round-1 Major is fixed: CI is green on all three shards, so shard 1's tests and the example rule check now run. The raised
budgets match the measured sizes and leave less than 1 KB of headroom. The new tag-row emit gives the laid-out 6 px gap and centres
the text on each rect. Trees without tags draw the same as before. The fit hint appears only when the figure has tags. The PPTX
manifest only adds `mindmap-tags`. What is left are small issues: the row can sit up to 3.5 px off the centre of its snapped box, the
merge with #464 will conflict and go over the budget again, and the PR doesn't cite the ADR 0080 approval for raising a budget.
converged: yes.

## Previous round
- M1 (bundle budget / shard 1): resolved. `gh pr checks 465`: golden, test 1/3, 2/3 and 3/3 all pass on run 45611825153. Shard 1
  logs `Vite: Spec catalog: mindmap: 122294` (budget 123000) and `esbuild: … tree: 92052` (budget 93000).
- m1 (uneven gaps / text off-centre): resolved. A probe ran over 320 tagged nodes: 5 tag sets × `tree` down/right × 7 mindmap layouts
  × default/`canvas: 'slide'`. On this head every gap equals the laid-out gap and every text is within 0.5 px of its rect's centre.
  The same probe on eba3409b reports many text offsets of 1–2 px. The new test reproduces the round-1 input (gap 6, text centred).
- m2 (fit hint without tags): resolved. The new test passes. `lib/fit-width.ts:258` appends the hint only when `plan.tagsHint` is set,
  and `lib/tree.ts:165` sets it only when some item has tags, so messages for trees without tags are unchanged. The test also asserts
  that the message without tags has no "tags".
- m3 (PPTX manifest): resolved. `node test/helpers/pptx/golden.ts examples/*.ts` on this head reports no `new` entry, and
  `mindmap-tags` matches the committed hash. On eba3409b it reports `new (not in the manifest): mindmap-tags`. The 11 `changed`
  entries (toc-*, icons) appear identically on both heads, so they come from local fonts. The manifest diff also moves `comic-faces`
  to its sorted place with the same hash (no content change).
- m4 (conflict with #464): not resolved (it is about merge order). Still applies; see m2 below.
- n1 (ADR text): resolved. D4 now says that whitespace-only tags are rejected (same rule as the label, and U3 `check()` will use it),
  and lists `{…, size, baseline}`. This matches `LaidOutTreeTag` (`lib/types/diagrams.ts:30`) and `lib/dsl/tree.ts:42`.

## Findings
### m1 (Minor): The snapped tag row can sit up to 3.5 px off the centre of its drawn box
- Evidence: `lib/emit-tree.ts:39` snaps the row origin from the laid-out `first.x`, but the box rect is drawn snapped (`renderBoxRect`).
  For `tree({label:'導入するか', tags:['A'], children:[…, {…, children:[{label:'x', id:'x', tags:['A']}]}]}, {dir:'down'})`: node `x` is laid
  out at 494+88 (centre 538) and drawn at 496+88 (centre 540). The tag is laid out at 525.5+25 and drawn at 524+25 (centre 536.5).
  The probe found 10 such rows (3–3.5 px). Base eba3409b has the same issue at 4 px, so this PR did not introduce it.
- Fix: centre the row on the snapped box (`snap4(n.x) + round((snapped box w - row w) / 2)`), or on the label's centre.

### m2 (Minor): Merging with #464 conflicts in four files and pushes `mindmap` / `tree` over both PRs' budgets
- Evidence: a trial `git merge origin/feat/tree-edge-style` conflicts in `lib/dsl/tree.ts`, `lib/emit-tree.ts`,
  `lib/types/diagrams.ts` and `scripts/check-package-bundles.ts`. Measured deltas from main: this PR adds +2955 (esbuild) and +3723
  (Vite) to `mindmap`. #464 adds +4074 and +4279 (its CI: 94409 / 122850). Together that is about 97.4 KB / 126.6 KB, against budgets
  of 94000–94600 / 123000.
- Fix: whichever PR merges second merges origin/main in (no rebase), measures again and raises both entries in that PR, with the
  numbers stated.

### m3 (Minor): The PR raises catalog budgets without citing the owner approval that ADR 0080 asks for
- Evidence: ADR 0080 (`docs/adr/0080-band-plugin.md:620`) says budgets only go down and need the owner's approval to go up. The
  numbers are justified, not inflated. `mindmap` Vite 122000→123000 against 122294 measured (706 B headroom). `tree` esbuild
  92000→93000 against 92052 (it would have failed by 52 B). `tree` Vite 121000→122000 against 120856, which was not strictly needed
  (the old budget had 144 B of headroom). The PR body states these numbers but no approval.
- Fix: record the owner's OK in the PR (or drop the `tree` Vite raise).

### n1 (nit): The tag hint appears whenever any node has tags, even when the tags are not what makes the figure too wide
- Evidence: `lib/tree.ts:165` uses `items.some(n => n.tags?.length)`. A tree with one 1-character tag that fails for its labels is
  still told "or shorten / drop the tags". This is harmless, but round 1 suggested limiting it to rows that set the box width.
- Fix: optional; set the hint only when some node's tag row is wider than its text.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 3 / nit 1)
