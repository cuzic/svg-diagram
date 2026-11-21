# PR #417 review (Opus, round 1)

Target: feat/source-locations-u3a @ 64ceb72654bc01e8614d58c510eb91dd8dd6800d

## Conclusion

The core of U3a is right. `Verdict.issues` is the only source, `problems` is derived at the end of `verifyDiagram`, and every location I probed points at the right call. I checked overlaps, row/grid/areas children, connects, bounds, callouts, top-level figure checks and contrast.

I compared `verdict.problems` between main and this branch with a differential run. It covered 191 examples × 7 perturbations (spacer(-60), half width, `appearance: 'auto'`, dark tone overrides, duplicated bands), which is 1,337 runs and 907 problem strings:

- **With capture off** (library, `show`, `serve`, spec, Worker): identical in content and order.
- **With capture on** (`check`): one run differs, by design. It is the `mergeSides` change (m3).

Not converged, for two reasons:

- A `build()` failure now dumps the whole laid-out diagram when it is printed (M1).
- The per-band `out` of `runCheckPhase`, the mechanism behind the 53 figure-check push sites, has no test that fails when its location is dropped (M2).

## Previous round

None.

## Findings

### M1 (Major): `build()`'s error now prints the whole `laidOut` (13 → 623 lines)

- **Location:** `lib/dsl/io.ts:92-94`.
- **What happens:** `Object.assign(new Error(…), {issues, laidOut})` makes both fields enumerable own properties. When the error is printed, `util.inspect` dumps them after the stack. That happens for an uncaught `await build(d, out)` in a user script, for `console.error(err)`, and for test-runner failure output. I ran it: a 10-row figure with one overlap prints 13 lines on main and 623 lines on this branch. Most of that is `laidOut` (bands, wrapped runs, `[Function: add]` …). Once capture is on (U4), it also prints each `issues[].loc` `SourceRef`.
- **Fix:** Attach both fields with `Object.defineProperty(err, 'issues', {value, enumerable: false})`, and the same for `laidOut`. A small `LayoutVerificationError` class with non-enumerable fields would also work. U4 reads the fields by name, so it still works. Add a test that `util.inspect(err)` contains neither `laidOut` nor `issues`, while `err.issues` and `err.laidOut` still read.

### M2 (Major): the top-level figure-check location (`runCheckPhase`'s per-band `out`) is untested

- **Location:** `lib/verify-handlers.ts:416-420` (`outFor(issues, warnings, sourceOf(band))`).
- **What happens:** I applied the mutation `outFor(issues, warnings, sourceOf(band))` → `outFor(issues, warnings)`. `test/check-layout-locations.test.ts` and `test/cli.test.ts` still pass (73/73), and no other test reads a layout `loc`.
  - The only figure-check test is the row/grid child case. `forChild` falls back to the child's own `SOURCE`, so that test passes either way.
  - This path covers every figure check on a top-level band: `stat`/`box` nowrap, chevron/funnel/cycle flow, gantt, states, cause, bpmn, wordart …
  - The behaviour is correct today. A probe with a top-level `stat` that is too long reports the `stat(...)` line (line 4).
- **Fix:** Add one top-level figure-check case to `test/check-layout-locations.test.ts`, for example a top-level `stat('8'.repeat(100), …)` → its own line. Confirm it fails under the mutation above.

### m1 (Minor): `checkAnnotations` and `checkLoopSide` locations are untested

- **Location:** `lib/verify.ts:95-130`.
- **What happens:** I removed `loc` (and the caption `related`) from all four `issueAt` calls there. The test files above still pass. The behaviour is correct: a probe with `callout('x', {text: '…', side: 'right'})` off the canvas reports the `callout(...)` line for both its line and its label.
- **Fix:** Add a callout-outside-the-canvas case, and optionally a `loop-side` case, to the JSON test.

### m2 (Minor): the "all example verdict.problems match the main baseline" test cannot detect a change

- **Location:** `test/check-layout-locations.test.ts`, last test.
- **What happens:** Every example passes `--strict`, so the test only asserts `problems` is `[]` for each example. It would not notice a reordering or a changed text, because no example produces a problem. The PR body's "全例で同じ配列" rests on that. The acceptance criterion (main と比べる) holds in fact: see my differential run in the Conclusion. But the repository has no test that would catch a future change.
- **Fix:** Rename the test to what it checks (examples stay clean under capture). Add a small set of failing fixtures whose expected `problems` arrays are pinned literally, covering overlap + connect + figure + bounds + contrast in one figure, plus an `appearance: 'auto'` variant. That pins the order of the seven groups in `verifyWith` and the light-then-dark merge. `problems === issues.map(message)` is true by construction and is not such a check.

### m3 (Minor): with capture on, `verdict.problems` of an `appearance: 'auto'` figure changes, and this is not documented

- **Location:** `lib/verify.ts` `verifyAuto` (`issueKey`); README `check` section; PR body.
- **What happens:** This is the intended D4 change ("同じ文言の別の部品を 1 つにまとめない"), but its effects reach further than the PR says.
  - **More lines in `check`.** Dark-only messages from distinct parts are no longer merged. One differential run: `examples/drama-triangle.ts` + `appearance: 'auto'` + dark tone overrides + narrow width. It has 21 problems on main (10 dark-only) and 29 on this branch (18 dark-only). All 8 extra lines are identical contrast messages from the boxes that the `dd()` helper makes on line 11.
  - **`check` disagrees with the other paths.** Only `check` enables capture, so `check` now reports more errors than `build`, `show`, `serve` or `checkDiagram()` for the same figure. Those still merge by text.
  - **Identical text lines.** Parts made on the same helper line resolve to the same `file:line:col`, so the text output shows the same line several times (only JSON `via` tells them apart).
  - The PR body says `problems` is unchanged, which is true only with capture off.
- **Fix:**
  - Add one sentence to the README `layout` paragraph: with `appearance: 'auto'`, a message that only the dark scheme reports is listed once per part in `check`.
  - Correct the PR body.
  - Optional: in text output, add the first `via` when two lines would otherwise be identical. This can be left for U3b.

### n1 (nit): ADR D5's text form differs from what Issue #416 specified and this PR implements

- **Location:** ADR 0072 D5 `--format text` (`✗ src/a.ts:12:5: …` on the `✗` line, plus a CHANGELOG note).
- **What happens:** The implementation follows the Issue: indented `  <file>:L:C: msg` lines under `✗ <src>:`, which also keeps the existing `✗ src:` header. The repository has no CHANGELOG.
- **Fix:** Claude side: update D5 to the indented form and drop the CHANGELOG sentence.

### n2 (nit): `Verdict.issues` is a required field of a public type

- **Location:** `lib/types/verdicts.ts`.
- **What happens:** Code that builds a `Verdict` literal no longer type-checks without `issues`. `test/spec.test.ts` had to change for this reason, and external `locateVerdict` callers are affected the same way. This is acceptable, because the ADR makes `issues` the single source.
- **Fix:** Mention it next to the README sentence, or leave it as is.

## Checked and fine

- **Locations.**
  - Overlap: `loc` = the earlier rect in band order, `related` = the later one.
  - Connect: `loc` = the connect, `related` = the box it hits, including "its own end".
  - Annotation: caption `related`.
  - Bounds: wrapper rows of `areas`/`grouprow` use the child's mark (`collectRects` keeps a rect's own `loc` and falls back to the band's).
  - Row/grid nowrap and contrast use `forChild`.
  - A probe over all examples found that row children are the only nested objects carrying their own `SOURCE`. Tree, cause, swimlane and table items have none, so a per-band `out` is the best location available there. Every laid-out band and every connect has a `SOURCE`.
  - Title-line, status and legend bands inherit `diagram()`'s mark, as the ADR says.
- **`mergeSides` identity.** Both sides use `{...d, appearance}`, a shallow copy, so they share the same `laidOut` objects and the same `SourceRef`s. Nothing that was merged before splits now unless the parts really are distinct. With capture off, every key is `0:message`, the same as before.
- **Output.**
  - JSON: `line`/`column`/`location`/`via`/`related` (`related` as `{file, line, column}`, relative to the working folder).
  - GitHub: annotation on the other file, with the source name as a prefix.
  - SARIF: `region` plus `relatedLocations` with ids.
  - Fingerprints are unchanged.
  - The shape matches what svg-diagram-vscode PR #4 parses (`related[].file` resolved against cwd, labelled 相手).
- **Process boundaries.**
  - The `--worker` pool runs only for `--drift --rebuild`, without capture, and sends resolved values.
  - No `Verdict` crosses `postMessage`: the deck reply carries `laidOut` and warnings, not the verdict.
  - Spec/MCP/Worker consumers read `problems`, which is unchanged without capture.
- **Purity and performance.**
  - `lib/verify*.ts` imports only `source-ref.ts`, which is browser-safe. The full suite's `web-entry` and purity tests pass.
  - 80 overlap issues resolve in `check` in 0.62 s on this branch vs 0.67 s on main.
- **Checks.**
  - `pnpm typecheck` and `pnpm lint` pass.
  - `pnpm test`: 3,055 pass, 8 fail. All 8 failures depend on the fonts installed locally (emoji, sans 700, Japanese fallback, budget/lint of examples). The PR reports the same 8 on main.
  - `gh pr checks 417` reports no checks on this branch, so CI has not run.
- **Conflicts.** None. The branch is based on current main (2dd0a1b). Of the open PRs, only #374 (gantt actuals) touches the same files: `lib/verify-handlers.ts` and `README.md`. Its `verify-handlers.ts` change is in a different hunk and only calls `problems.push(string)`, which the new `VerifyOut` still accepts.

## Verdict

converged: no (Blocker 0 / Major 2 / Minor 3 / nit 2)
