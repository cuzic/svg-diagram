# PR #417 review (Opus, round 2)

Target: feat/source-locations-u3a @ b3e2d3604f8d4813046baa5c0ea7d5f68745d5f6

## Conclusion

All seven round-1 findings are fixed, and I confirmed each fix by its behaviour. I re-applied the round-1 mutations and added new ones. Each mutation now fails exactly one targeted test in `test/check-layout-locations.test.ts`.

With capture off, `problems` content and order are still identical to main:

- Since round 1, nothing on the `verifyDiagram` path changed except a type (`Verification` is now `Required<…>`). The round-1 differential run (1,337 runs) therefore still holds.
- I also ran the new pinned capture-off fixture against main (2dd0a1b) and against this branch. Both the light result and the `auto` result are byte-identical.

The output of all four formats matches README and the rewritten ADR D5. CI passes on the head SHA. Converged.

## Previous round

- **M1, fixed.** `build()` now attaches `issues` and `laidOut` with `Object.defineProperty(…, {enumerable: false})`. The test asserts four things: `inspect(err)` shows neither field, `JSON.stringify(err) === '{}'`, both descriptors are non-enumerable, and `err.issues` / `err.laidOut` still read by name. Making either field enumerable fails that test.
- **M2, fixed.** A new test, `layout nowrap points to a top-level stat`, fails under `outFor(issues, warnings, sourceOf(band))` → `outFor(issues, warnings)`.
- **m1, fixed.** There are four new JSON tests:
  - callout outside the canvas (line + label);
  - callout over a caption (`related` = the caption);
  - loop-side line;
  - loop-side label.
  Removing `loc` from any of the four `issueAt` calls, or removing the caption's `related`, fails the matching test.
- **m2, fixed.** The examples test is renamed to what it checks. The new test `layout problems keep their exact text and order without source capture` pins the literal `problems` of one failing figure, with fixed text widths so the result does not depend on fonts. It covers overlap, connect, annotation, loop-side, figure (row stat), bounds and contrast, in both light and `auto`. Swapping any two groups in `verifyWith` fails it, and so does breaking the capture-off merge (a non-constant key for `loc === undefined`).
- **m3, fixed.**
  - README now says that `check` (capture on) reports a dark-only message once per part, and that paths with capture off merge it.
  - The PR body is corrected.
  - Both behaviours are pinned: capture on by `layout auto appearance keeps identical dark-only issues on distinct boxes` (a text-only `issueKey` fails it), capture off by the pinned fixture (two `Repeated` boxes give one dark line).
- **n1, fixed.** ADR D5 `--format text` now describes the implemented form, and the CHANGELOG sentence is gone.
- **n2, fixed.**
  - `Verdict.issues` is optional.
  - `verifyDiagram` always sets it (`Verification` is `Required`).
  - `check-diagram.ts` and `build()` fall back to `problems.map(message => ({message}))`.
  - `test/spec.test.ts` again builds a `Verdict` without `issues`.

## Findings

### n1 (nit): the `issues ?? problems` fallback is unreachable from the public paths and has no test

- **Location:** `check-diagram.ts:440`, `lib/dsl/io.ts:93`.
- **What happens:** Both verdicts come from `verifyDiagram`, which always sets `issues`, so the fallback never runs today. If I mutate either fallback to `?? []`, no test fails. The PR body says the fallback was "confirmed", but that check is not in the repository. The fallback is a defensive line for the now-optional public type, and its text form is the obvious one, so this is not a test gap on a key path.
- **Fix:** None needed. Optionally, pin it in U4 when `build`'s CLI starts reading `err.issues`.

## Checked and fine

- **Readers of `issues`.** In code outside the tests, only two places read `Verdict.issues`: `check-diagram.ts` and `build()`. Both handle the field being absent. Spec, MCP, Worker, `show`, `serve`, `pptx-edge` and `render-source` read only `problems` and `warnings`. No code serialises a whole `Verdict`. `locateVerdict` ignores `issues`.
- **U4 readiness.** `err.issues` and `err.laidOut` are own properties that can be read by name. They are absent from `inspect` and from JSON, and they carry the same `SourceRef` objects as `verdict.issues` (the test checks `err.issues[0].loc === sourceOf(first)`).
- **Output vs README / ADR D5.** I probed a same-file overlap, an overlap whose primary part is created at the top level of another file (`_shared.ts`), and a `build-error`:
  - **text:**
    - `✗ src/c.ts:` followed by `  src/_shared.ts:2:23: …`;
    - for a same-file location, `  src/a.ts:5:5: …`;
    - for a build error, `✗ src/b.ts:5:5: …`.
  - **github:** `file=src/_shared.ts,line=2,col=23` with the message prefix `src/c.ts: `.
  - **json:** `location: {file, line, column}` with `file` = the checked source, and `related` relative to the working folder.
  - **sarif:** `region` plus `relatedLocations` with ids, and the same `src/c.ts: ` prefix for the other-file case.

  All of these match README and ADR D5 as rewritten.
- **`untested-exports.json`.** It drops `layout:layoutWith`, which is correct now that the pinned fixture imports it.
- **Checks.**
  - `pnpm typecheck` and `pnpm lint` pass (lint reports only pre-existing infos).
  - `gh pr checks 417`: `test (1/3)`, `test (2/3)`, `test (3/3)` and `golden (examples/out)` all pass on b3e2d36.
- **Conflicts.** None. GitHub reports `MERGEABLE` / `CLEAN`, and the branch is based on current main (2dd0a1b). The only other open PR touching these files is #374. `git merge-tree` of #374 with this head is clean.

## Verdict

converged: yes (Blocker 0 / Major 0 / Minor 0 / nit 1)
