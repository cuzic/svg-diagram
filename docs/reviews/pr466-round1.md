# PR #466 review (Opus, round 1)

Target: feat/spec-tree-edge-tags @ 5e833c9e93424b0e088b9f33537c27ec736d4d51

## Conclusion
U3 does what ADR 0081 D7 asks: only the `mindmap` part gains `edge` / `tags`, every other part's schema and `schema/*.json` outside the mindmap branch are byte-identical to main, the D3 errors come back from `check()` with correct paths at every depth, and spec and DSL draw identical SVG in all seven edge-capable layouts. The schema growth (+4,595 B compact in the MCP `inputSchema`, +3.5 %) is real but not a Major: `$defs`/`$ref` is not a small change here (the in-house validator, the selective `checkSchema` keyword whitelist and the MCP plugin would all have to learn it), and a cheaper trim of about 40 % of the growth is available (m1). Budgets are measured values plus a small margin. converged: yes.

## Previous round
First round.

## Findings
### m1 (Minor): the edge/tags sub-schema repeats its English descriptions at all six depths; about 1.8 KB of the 4.6 KB growth is duplicate text in the MCP tool's input schema
- Evidence: ran `node` on `partCatalog()` / `specSchema` (main as `git archive origin/main`, branch head). Compact `specSchema` (what `svg-diagram-mcp-plugin/src/tools.ts:21` puts into the tool's `inputSchema`): 129,493 -> 134,088 B. mindmap schema 2,719 -> 7,314 B; `edge`+`tags` is 920 B per level (`lib/spec-parts/mindmap.ts:5-11`, applied by `treeItem(levels, extra)` at `lib/spec-kit.ts:155-161`). The pretty-printed `schema/spec.schema.json` +17,884 B is mostly indentation. A variant that keeps the descriptions only on the first child level (and leaves them out below, plus drops `edge` from the root level) measures 5,499 B (-1,815 B). `$defs`/`$ref` is not a drop-in: `lib/spec-validation.ts:12-52` has no `$ref`, and `lib/spec-selective.ts:29-41` throws `unsupported schema keyword` on any key outside `SCHEMA_KEYS`, so a selective user's part with `$ref` would be refused; that belongs in its own ADR if wanted.
- Fix: pass the depth to `extra` (or a `detailed` flag) and emit the `description`s of `edge` / `tags` only at the first child level; optionally leave `edge` out of the root item (the `check()` root message then becomes the schema's "not a known field", so keep it if the Japanese guidance is preferred).

### n1 (nit): the whitespace-only branch of `checkBranchStyle` is unreachable
- Evidence: `lib/spec-parts/mindmap.ts:24`. `validate()` already reports `must not be empty` for a whitespace-only string with `minLength` (`lib/spec-validation.ts:19`, `!v.trim()`), and part `check()` is not run when the schema has issues; probes `tags: ['  ']` and `tags: [{text: '　'}]` return only the schema's English issue. The rule matches the DSL (`!text.trim()`), so behaviour is correct; the PR text and test comment imply the Japanese message is what users see.
- Fix: drop the branch, or keep it with a comment saying the schema catches it first.

### n2 (nit): the Vite budget margin differs from the stated one, and the file's budget comment no longer describes the row
- Evidence: built (`pnpm build`) and ran a temporary copy of `scripts/check-package-bundles.ts` filtered to the mindmap/tree catalog cases (not committed): mindmap esbuild 99,720 B (limit 99,900, +180), Vite 128,789 B (limit 129,100, +311); tree esbuild 95,498 / Vite 124,631 (limits 95,700 / 124,800, unchanged). Not inflated, but the Vite value was not "measured + about 200 B" as the PR says, and the comment at `scripts/check-package-bundles.ts:124` ("10% headroom rounded up to 1,000 bytes") does not match these rows (already true of tree before this PR).
- Fix: optional: set Vite to 129,000 and say "measured + ~200 B" in the comment for the tightened rows.

### n3 (nit): one line in the new test is indented by 4 spaces
- Evidence: `test/spec-tree-edge-tags.test.ts:76`.
- Fix: re-indent.

## What was checked and held
- Other parts: `partCatalog()` main vs branch differs only for `mindmap`; `specSchema` with the mindmap branch masked is identical; `git diff origin/main -- schema` touches only `spec.schema.json`, and only inside the mindmap branch (the two `-` lines are the example's changed objects). `pnpm schema` on the branch leaves the tree clean (reproducible). `test/schema-files.test.ts`, `test/spec-selective.test.ts`, new test: 106/106 pass locally.
- D3 rules vs DSL (`lib/dsl/tree.ts:37-47,59-70,110-113`): root `edge` (also with `edges: false`, root wins as in the DSL), `edges: false`, `brace`/`fishbone`/`timeline`, `edges: false` + `fishbone` (edges-false message, same order as DSL); code points via `[...s]` (8 astral emoji pass, ZWJ sequence counted as code points like the DSL); `> 3` tags and bad tones by the schema; `edge: null`, `tags: [null]` rejected by the schema. Paths correct at depth 0-4; selective entry returns identical issues for every probe.
- Pass-but-fail-to-render: rendered a 5-level tree with three 8-character tags per node, `maxNodeW: 120`, across all 10 layouts x 3 edge styles through `renderSpec` (selective). Failures were only the existing "does not fit" path (ADR D4 says that path is used) and the pre-existing `edges: 'curve'/'straight'` vs org/list/brace/... error, not something this PR adds.
- Spec->SVG parity: `renderDiagram(specToDiagram(spec))` equals the DSL's SVG byte for byte in radial, right, left, down, up, org, list with edges + tags at several depths.
- Catalog example validates (test) and draws.
- CI: golden, test 1/3-3/3 pass at the reviewed head. No other open PR touches these files.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 3)
