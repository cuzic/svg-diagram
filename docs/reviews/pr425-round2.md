# PR #425 review (Opus, round 2)

Target: feat/spec-finding-paths @ ba9241c738ce00456e4324eb901782f7393e4f3e (base main @ 44e75344)

## Conclusion

The fix in ba9241c searches the finding's stamped parts in order (`loc`, then `related`). It falls back to the bare `parts[i]` of `loc` only when none of them names a field. In the main-vs-branch sweeps, every field path that main had right is now kept. The only remaining path changes from a non-null main path are the 12 corrections from round 1, and the SVG and every other output are unchanged. M1 is resolved, and no new Blocker or Major was found. One Minor test gap remains. converged: yes.

## Previous round

- M1: resolved, checked by behaviour. In a new clone, I re-ran the round-1 probes (`run.ts`, `pairs.ts`) on ba9241c and compared them with the main (44e75344) output from round 1. main has not moved since then.
  - Sweep A (node + edge, 1,040 specs each): 175 null→path improvements and no other path change. `ok`, the SVG hash, size, `issues`, `problems`, and the warning count, text, rule, severity, fix and order are identical.
  - Sweep B (node, 12,675 ordered pairs at w240/320/480): 2,784 null→path improvements, 0 output diffs and 12 changes from a non-null path. In all 12, `judge.ts` shows that main's part does not emit the warning when drawn alone (MAIN-WRONG), so they are the round-1 corrections (raci↔tree, raci↔sequence, gantt↔whyWhyTable, rangeBars↔matrix, rangeBars↔whyWhyTable, table↔timeline).
  - Round-1 branch (c445da7) vs this head: exactly the 15 M1 regressions changed (`parts[0]` back to `parts[1].{columns[2]|primary[3]}.label`), and nothing else.
  - The new test `a grouped spec warning locates a field in a related part` pins `[matrix, table]` at w320 to `parts[1].columns[2].label` in node and edge. Dropping `f.related` from `locateVerdict` fails 3 tests. Removing the `loc.specPath` fallback fails 2 tests.

## Findings

### m1 (Minor): the "keep looking when the part's guess resolves to the part itself" branch has no test
- Evidence: the mutation `if (path !== null && path !== at) return path;` → `if (path !== null) return path;` (`lib/spec.ts:884`) makes 0 of the 83 tests in `spec-source-locations` + `spec` fail, and it changes no path in sweep B. The branch is reasoned in a comment, but neither a test nor the catalog exercises it. I found no wrong output.
- Fix: add a small hand-made case where the quoted text appears twice in `loc`'s part (the guess resolves to `parts[i]`) and once in a `related` part, and pin the expected path. Or drop the condition if that case is not meant to be handled.

## Other checks

- `gh pr checks 425`: golden and test 1–3 pass on ba9241c. The PR is MERGEABLE/CLEAN.
- `locateMessage` (single-ref) is unchanged for problems and `render-check` (spec-render.ts / spec-edge.ts callers). Only `locateVerdict` findings use `related`.
- The ADR 0072 D7 text now matches the code: `loc` then `related`, first field found, otherwise the `loc` stamp, otherwise the whole-spec search.
- Overlap with other open PRs: #374 touches `lib/spec.ts` only at lines 320–380 (the part table), so it does not conflict.

## Verdict

converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 0)
