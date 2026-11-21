# PR #422 review (Opus, round 2)

Target: feat/source-locations-u4b @ 4364e6cc4673f74c42c7d2c1f7b874f7b4c15b66

## Conclusion

The fix for M1 works as specified. The spec stamp now keeps the stack that a part already had and adds `specPath` to it. Spec paths still read only `specPath`, and the CLI reads only the stack. `locateError` no longer returns early. My round-1 reproduction now gives the same `check` output as main in text, JSON and SARIF. Spec paths are unchanged since round 1, and `renderSpec` gives byte-identical results to main. I found nothing new.

## Previous round

- M1 (`check` loses `file:line:col` for `.ts` figures that use `svg-diagram/spec`): fixed. Verified by behaviour and by mutation.
- m1 (findings not narrowed by `f.loc`): deferred until after #419, as the task spec decided. It is recorded under Open questions in the PR body.
- m2 (the board-link test does not exercise narrowing): fixed. The test is renamed, and a comment explains why narrowing cannot change a board link.
- n1 (why the unknown-anchor test edits the connector by hand): fixed in the PR body.

## What I ran

- Round-1 reproduction. I made a fixture package named `svg-diagram` whose `./spec` export re-exports `lib/spec.ts`, plus a `.ts` figure whose `define()` returns `specToDiagram({...})` with two swimlanes. I ran the same fixture against main (44b006d) and against this branch.
  - Thrown layout error: both print `✗ specfig-th.ts:9:10: swimlane(): 8 columns leave only 9px each …`.
  - Overlap: both print `specfig-ov.ts:9:10: "共有" overlaps "確認" by 744x41px`.
  - `--format json` and `--format sarif` give byte-identical output on main and the branch.
- A different module copy (the CLI from `.ts` and `svg-diagram/spec` from a built `dist`). Its capture flag is off, so the marks carry only `specPath`. Main and the branch both print no location: the error is thrown at layout time, after `define()` has returned. No regression.
- Spec paths. The only reader of `specPath` is `lib/spec.ts:872`, which has not changed since round 1, so the round-1 comparison (never coarser than main) still holds.
  - As a cheap re-check, I ran every `partCatalog()` example through `renderSpec`, at the default canvas and at 1280×360 or 320 wide: 130 specs. A hash of the result JSON (SVG, issues with paths, findings) is identical on main and the branch.
- Mark identity, for U3a and #423. `captureHere` creates one `SourceRef` per stack holder, so the new per-holder `Map` in `assemble()` keeps the same identity classes as main: bands that shared a ref still share one, and distinct holders still get distinct refs.
  - U3a layout issues and #423's `locationsMap` resolve through `locateSource(ref)`, which reads only `stackHolder`. The combined ref therefore resolves exactly as the stack-only ref did.
  - #423's `r.loc === ref` dedupe compares refs taken from the same band, and the stamp never changes their equality.
- Workers/MCP path (capture off). Each part now allocates one `Map` and one `SourceRef(undefined, at)`, and output is unchanged (above). The ref is still a symbol-keyed property, and the `postMessage` paths still send only strings and SVGs.
- Hand mutations, each run against `test/spec-source-locations.test.ts`, `test/source-location.test.ts` and `test/check-layout-locations.test.ts`. All were caught:
  - The stamp drops the stack (`new SourceRef(undefined, at)`): the new CLI test (build-error and layout), the stack-keeping test and the board-child test fail.
  - `locateError` returns early again on a specPath-only mark: the `locateError` unit test fails. The CLI test cannot catch this, because with capture on every spec mark has a stack. That is acceptable.
  - One ref per part from the top band's holder: the board-child test fails.
  - Only top-level bands are stamped (no `walkBands`): two tests fail.
  - `specPath` is left out of the ref: five spec-location tests fail.
- `pnpm typecheck` and `pnpm lint` pass. The touched test files pass (107/107). `gh pr checks 422`: golden and test 1/3, 2/3, 3/3 all pass.

## Findings

### Blocker

None.

### Major

None.

### Minor

None.

### nit

None.

## Conflicts with open PRs

- #419 (U3b) and #423 (U4a) conflict with this PR only in the status line of `docs/adr/0072-source-locations.md` (`git merge-tree`). Whichever merges second must keep every "実装済み" entry and every review note.
- #374 and #413 merge cleanly.

## Verdict

converged: yes (Blocker 0 / Major 0 / Minor 0 / nit 0)
