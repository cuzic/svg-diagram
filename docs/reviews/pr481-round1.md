# PR #481 review (Opus, round 1)

Target: feat/decision-ladder-u2 @ c80ca5004e0e59167ab59e8b56866d28cfffbe9c

## Conclusion
The spec part matches ADR 0083 D5. A spec draws the same band as the DSL for every listed option. The JSON Schema behaves the same under Ajv as `validateSpec`. The selective entry, CLI allowlist, exports, bundle budgets, deck use (`renderDeck`, `pptx-deck`, ts and spec figures) and the goldens all work, and CI and a `pptx-golden` compare run on this head are green. What is left: one test gap (a mutation survives), a limitation that is not stated (one ladder per spec figure, and its message gives no fix), and a stale count in the README. converged: yes.

## Previous round
n/a (round 1)

## Findings

### m1 (Minor): the anchor test does not pin the `a1..aN` / `otherwise` anchors; removing them leaves every test green
- Evidence: I edited `anchors` in `lib/spec-parts/decision-ladder.ts` so it returns only `q${i+1}`, then ran `node --test test/decision-ladder-spec.test.ts test/spec.test.ts test/spec-selective.test.ts`: 167 pass, 0 fail. The test's assertion `/q1|a1|otherwise/` is met by `q1` alone. With the mutation, a spec holding a flowchart node `id: 'otherwise'` and a ladder passes `validateSpec` (`[]`). It then throws only at layout (`duplicate anchor id "otherwise"`) and gives no spec path. The shipped code is correct: the unmutated code reports `parts[1].steps[0]` / `parts[1].otherwise`.
- Fix: assert the exact set of colliding ids/paths in the two-ladders test (q1, a1, …, otherwise), and add one test where a flowchart node id `a1` or `otherwise` collides.

### m2 (Minor): a spec cannot hold two ladders, and nothing says so; the error does not tell how to fix it
- Evidence: two `decisionLadder` parts in one spec give 2N+1 issues of the form `"q1" is already used in parts[0] (ids must be unique in the figure)` at `parts[1].steps[0]`. That is correct per D5 (fixed ids), but the spec offers no `scope` / `id`, so the author cannot rename. The README section only says "同じ図に 2 つ置くときは `scope` を付ける" (DSL; I checked that two scoped ladders draw with 0 problems). The spec line of the README and the part description do not state the limit. This is the first spec part whose anchors are fixed ids (`anchors: (part, at) => …` has no precedent in `lib/spec-parts/`), so the generic message was never worded for it.
- Fix: add one sentence to the part description and the README spec line ("one decisionLadder per spec figure; its ids are fixed"). Optionally make the collision message say "decisionLadder's ids q1../a1../otherwise are fixed: use one ladder per figure, or rename the other part's id".

### m3 (Minor): README still says the catalog has 65 parts with their own entries
- Evidence: README.md:174 says "既存カタログの全65部品に個別入口があります". `./spec/parts/*` exports went from 65 to 66 in this PR, and `partCatalog().length` is 66.
- Fix: change it to 66, or drop the number.

### n1 (nit): `spec-cli-parts.ts` puts `'decision-ladder'` after `'fault-tree'`; the rest of the table is alphabetical (package.json, side-effects.json and the bundle tables put it in order).

### n2 (nit): the NoFit message in spec context says `fix: widen the figure (diagram({width: 1000}))`, which is DSL syntax and a width above the spec's 940 cap
- Evidence: `svg-diagram spec` at `width: 320` with an unbreakable 48-char word. This message is shared with flowchart (`lib/fit-width.ts`), predates this PR, and `spec-result.ts`'s `WIDEN_DIAGRAM` rewrite does not match this wording. A follow-up could reword it for spec (`width` up to 940, or shorten the text).

### n3 (nit): `sub: ''` (DSL: allowed, "'' for none") is rejected by the spec (`text()` has minLength 1). This rejection errs on the safe side and matches other parts. Note it only if parity is meant to be exact.

## Checks run
- `node --test` decision-ladder-spec / spec-selective / side-effects / spec / package / schema-files: 194 pass, 0 fail. The two ledger tests the author fixed after the full run pass.
- `pnpm schema` regenerated with no diff. Ajv (draft-07) on `schema/spec.schema.json`: accepts the string and object forms of `otherwise` and empty arrow words. It rejects a missing `otherwise`, `dir`, empty `steps`, and `otherwise` without `label`.
- `svg-diagram spec … --part decision-ladder` renders. `--part flowchart` rejects the type with a clear message.
- `pptx-deck` with a `.diagram.ts` ladder slide and a spec ladder slide (diamond, tone, sub) writes 2 slides with no error.
- CI on the head: test 1/3–3/3 and golden pass (test includes `check-package-bundles`). A `pptx-golden` compare run (workflow_dispatch, run 45763920265) on this head succeeds.
- Observation, not a finding: locally, `svg-diagram spec` prints `text out of its box by 4px` for the はい/いいえ chips. Flowchart edge labels print the same line on this machine (pre-existing, local fonts). For the ladder the location is only `parts[0]`, because the default words are not spec fields.
- Other open PRs that touch the same files: #480, #482 (generated `schema/spec.schema.json`, README), #479, #374 (README, `lib/spec.ts`, `test/spec.test.ts`). Expect textual conflicts only; regenerate the schema after merging.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 3 / nit 3)
