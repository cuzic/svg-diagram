# PR #465 review (Opus, round 3)

Target: feat/tree-tags @ 3f4cdc36aa3bd8438e710112f266c3a49a939bb6

Scope: only the changes after round 2 (b18922a2). That is the merge of origin/main (#464, ADR 0081 U1 `edge`) with hand-resolved
conflicts, one combined edge+tags test pair, and re-measured budgets.

## Conclusion
The conflict resolution keeps both sides. I checked `git show --remerge-diff 3f4cdc36` and `git diff cb2f37ce HEAD`. Against main, the
branch only adds the tag code, and the U1 draw order, trunk/own split, org bus rule and `edge` checks are unchanged. A probe render of
edge+tags draws default lines, then styled lines, then boxes, then tags, then text. CI is green (golden + 3 test shards, including
`check-package-bundles`). The new budgets are measured + 160–220 B. converged: yes. One Minor test gap remains.

## Previous round
- m1 (tag row up to 3.5 px off the snapped box centre): not resolved. The merge leaves `lib/emit-tree.ts` tag placement unchanged. This
  predates the PR (base has it too) and stays Minor.
- m2 (merge with #464 conflicts and goes over budget): resolved. The merge was done (no rebase), the four conflicted files were
  resolved, and budgets were re-measured: mindmap 97319/126536 → 97500/126700, tree 95480/124628 → 95700/124800. The CI test job runs
  `node scripts/check-package-bundles.ts` and passes.
- m3 (owner approval for raised budgets): resolved. The merge commit message cites the owner's approval (ADR 0080 D12, 2026-11-25).
  The PR body does not repeat it.
- n1 (tag hint on any tagged tree): not addressed (optional). `lib/tree.ts` still uses `items.some(n => n.tags?.length)`.

## Findings
### m1 (Minor): The merge changed tag errors to use the caller's prefix (`mindmap():`), but no test checks it
- Evidence: `lib/dsl/tree.ts` `checkTags(n, caller)` now gets `who` from `treeBand(root, opts, who)`. A probe run gives
  `mindmap(): "a": the tag "123456789" is 9 characters …` and `mindmap(): "a": the tag "x" has tone bogus (use accent, muted, danger)`,
  which is correct. But every tag error test in `test/tree-tags.test.ts` (e.g. lines 129 and 134) matches the message body only, through
  `tree(...)`. If `checkTags` went back to a hard-coded `tree():` prefix, no test would fail. U1 has a test like this for `edge`
  (`test/tree-edge-style.test.ts:238-243`).
- Fix: add one `mindmap({... tags: ['123456789']})` assertion that the message `startsWith('mindmap():')`.

### n1 (nit): The combined SVG test checks pill-before-text and path-before-pill, but not box-rect-before-pill
- Evidence: `test/tree-tags.test.ts` (new `edge and tags together (svg)`) compares `<path`, `rx="12"` and `>決定<` positions only. In the
  probe the box rects (`rx="8"`) come before the pills (`rx="12"`), so the output is correct. The round 1 tests already pin box → tags
  for trees without edges.
- Fix: optional. Also assert `svg.lastIndexOf('rx="8"') < svg.indexOf('rx="12"')`.

## Checks run
- `git show --remerge-diff 3f4cdc36` on all four conflicted files: the union is correct. `EDGE_TONES` (accent, muted, danger) equals
  the dropped `TAG_TONES`. The band-node `tags` rejection still runs before `checkTags`. `TreeItem` has both `edge` and `tags`.
  The imports are the union.
- `git diff cb2f37ce HEAD -- lib/`: only the U2 tag code is added on top of main. No U1 line was removed or changed.
- Probe render (edge accent solid on `a`, danger dashed on `b`, tags on both): plain path first, trunk/own split for the styled lines
  (`#1d5fa8`, `#b91c1c` + `stroke-dasharray="6,4"`), boxes `rx=8`, pills `rx=12` centred, then text.
- `node --test test/tree-tags.test.ts test/tree-edge-style.test.ts`: 49/49 pass. `gh pr checks 465`: golden, test 1–3 pass
  (byte identity for trees without edge/tags holds through the golden job).
- `gh pr list`: no other open PR touches these files.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 2 / nit 2)
