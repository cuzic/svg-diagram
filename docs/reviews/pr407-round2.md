# PR #407 review (Opus, round 2)

Target: `feat/source-locations-u1` @ `c2ed8bcd37578429566e1dac7f2bdfe9d5d0662d`

## Conclusion

All six round-1 findings that were in scope are fixed. The fixes behave as the task spec says, and each one is pinned by a test that fails under a hand mutation. The new package-frame rule skips the tool's own files: the package root's direct `.ts`/`.js`, `lib/` and `dist/`. It does this from source, from a built `dist/`, and from a package installed under `node_modules` and run through `bin/svg-diagram`. It does not skip user files under `examples/` or `test/` in a clone. The M2 output follows the decision in the task spec for text, `build`, github, json and sarif. I found no new Blocker or Major. Two Minors and one nit are left. Two are doc gaps (ADR D3 still describes the old skip rule, and the D3 table is out of date). The nit is a cosmetic change in the VS Code extension's preview banner. **converged: yes.**

## Previous round

- **M1** (package files taken as user files under `--drift --rebuild`): **resolved**. I re-ran the round-1 repro (`src/nested.ts` with a missing nested import, `src/usesjson.ts` with a malformed JSON import) with `--drift --rebuild` using the cache, `--no-cache` and `--jobs 2`. The run was from source, from `dist/`, and from a copy installed under `node_modules` and run through `bin/svg-diagram`. In every case there is no `location`, and no path into `drift-cache-io` or `drift-pool`. A helper that throws at top level is still located in the helper (`src/_throws.ts:1:33`) in all six runs.
- **M2** (the `✗` line drops the figure that failed): **resolved**. `check` and `build` print `✗ src/usesbad.ts: src/_bad.ts:1:21: Expression expected` and `✗ src/usesbad2.ts: …`, one line per figure. A same-file location keeps `✗ src/inline.ts:2:32: …`. In github format the annotation sits on `file=src/_bad.ts`, and its message has the prefix `src/usesbad.ts: `. In SARIF, `message.text` has the same prefix and the location is `src/_bad.ts`. `partialFingerprints` keep the unprefixed message. The JSON output is unchanged (`file` is the source, and `location` points to the other file). All of this matches the decision in the task spec, and the D5 sentence and the README were updated.
- **m1** (side-effect import gets no location): **resolved**. `import './_side-typo.ts';` gives `src/side.ts:2:9`. A unit case was added to the located-errors table.
- **m2** (a throwing `toString` crashes `SVG_DIAGRAM_DEBUG=1`): **resolved**. With `SVG_DIAGRAM_DEBUG=1`, a source whose error `toString()` throws prints `✗ src/tostr.ts:3:30: custom`, then the `Error: custom` header and the stack, and the next file is still checked. `formatBuildError` now also guards the stack read.
- **n1** (source maps in the DEBUG stack): **not fixed, as the spec decided**. No change.
- **n2** (a non-Error that has a stack loses its frames): **resolved**. `Error.captureStackTrace(o); throw o` is located at the `captureStackTrace` line (`2:49` in my probe, `3:9` in the PR's test).

## Findings

### m1 (Minor): ADR 0072 D3 still describes the old skip rule

`docs/adr/0072-source-locations.md` D3 still says the skipped frames are "the directory of the module that defines `located` (`lib/` or `dist/lib/`), the CLI entry files and `node:` frames". It then says explicitly that the rule is **not** decided by the package root, because a clone would treat `examples/` as inside. The code now does exactly that, by package root: `lib/source-location.ts` skips `<packageDir>/lib`, `<packageDir>/dist`, and `.ts`/`.js` directly under `<packageDir>`. It is narrowed so that `examples/` and `test/` stay user files, and I confirmed that they do. The task spec authorized the new rule but allowed only the D5 sentence in the ADR to change, so D3 and the code now disagree. Fix (ADR owner, at merge or in U2a): rewrite that D3 bullet to "the package root's direct `.ts`/`.js`, plus `lib/` and `dist/` below it, plus `node:`. Subdirectories such as `examples/` and `test/` are not skipped, so the figures in a clone stay the user's". One consequence should be noted there. A helper placed directly at the root of a clone (`probe-root-helper.ts` imported from `examples/`) is now skipped, so the error has no location (ran: `✗ examples/zz-probe2.ts: root helper`). This is a safe fallback and fine to accept, but it should be written down.

### m2 (Minor): `findPackageJSON` sets a hidden Node floor of 22.14 at module load

`lib/source-location-io.ts` does `import {findPackageJSON} from 'node:module'`. That export exists from Node 22.14 / 23.2. `engines` and the README say `>=22.18`, so this is within the documented contract. I checked on 22.18.0: the 11 unit tests and 25 located CLI tests pass. However, `bin/svg-diagram` still says it runs on 22.6–22.17 with `--experimental-strip-types`. On 22.6–22.13, `check` and `build` would now fail while linking with a SyntaxError about a missing named export, instead of a readable message. Fix: either drop the 22.6–22.17 branch and its message from `bin/svg-diagram` (the declared floor is 22.18 anyway), or read it as `import * as nodeModule from 'node:module'` and fall back to `path.dirname(import.meta.dirname)` when `nodeModule.findPackageJSON` is missing. I did not run this on 22.6–22.13 myself. The floor comes from the Node API docs.

### n1 (nit): the VS Code extension's preview banner now shows the absolute path and line for same-file errors

`svg-diagram-vscode/src/preview-html.ts` `buildErrorText` strips `` `${file}: ` `` from `✗` lines, because the panel title already names the source. With U1, a same-file error is `✗ /abs/a.ts:2:32: msg`, so the prefix no longer matches and the banner shows the full path. It is not wrong (it now shows the line), and the other-file form `✗ /abs/a.ts: /abs/_bad.ts:1:21: …` still strips correctly to `/abs/_bad.ts:1:21: …`. `crashFinding` reads `:(\d+)` right after the source path, so it would now pick up the line. It cannot be misled by the other-file form, because `: ` follows the path there. The extension's JSON path (`check.ts`) reads only `file`/`line`/`message`/`rule`/`severity` and is unaffected. No core change is needed. An extension follow-up could strip `` `${file}:` `` followed by `\d+:\d+: ` as well.

### Checked and found correct (no finding)

- **Package-frame rule, by layout.**
  - From source in the clone: `examples/_probe_helper.ts` and `test/fixtures-probe/_h.ts` that throw at top level are located in the helper, with the figure kept in front.
  - From `dist/` built by `pnpm build` (`node dist/check-diagram.js`): same result. `findPackageJSON` walks up from `dist/lib/` to the root `package.json`, because `dist/` has no `package.json`.
  - Installed under `node_modules/svg-diagram` (package files plus deps), run via `bin/svg-diagram check|build`, with sources importing `'svg-diagram'`: same text output. `--drift --rebuild` without `--no-cache`, with `--no-cache`, and with `--jobs 2` gave no tool locations.
  - The checked source is matched before the package skips, so a figure at the package root is still located (unit test).
- **Text formats.** `check` and `build` print the same line for the same source. `buildErrorSite` compares `loc.file === source`, and this holds because `displayFile` returns the caller's own spelling of the source for both header and frame locations.
- **Old `formatBuildError(SourceLoc)` signature.** It is gone, and every other caller (`show`, `deck`, `pptx`, `lib/deck-load.ts`) already passed a string. Typecheck passes.
- **Purity.** `lib/source-location.ts` still imports only `node:path`/`node:url`. `findPackageJSON` is used only in `source-location-io.ts`, which is in `SHELL`. `error-format.ts` keeps `import type`. The browser entry is unaffected.
- **Baseline and SARIF fingerprints.** They are computed from the unprefixed `f.message`. The PR test asserts `partialFingerprints` and the prefixed `message.text` side by side.

### Mechanical verification

- `gh pr checks 407` on `c2ed8bc`: golden, test 1/3, 2/3 and 3/3 all pass.
- Hand mutations, each reverted:

  | Mutation | Result |
  | --- | --- |
  | Delete the root-direct-file skip | The drift CLI test and the unit fallback test fail |
  | Delete the `dist/` skip | The unit fallback test fails |
  | `buildErrorSite` returns only the location (figure dropped) | The two-figure test fails |
  | SARIF message without the prefix | The github/SARIF test fails |
  | n2: read the wrapper's `err.stack` again | The non-Error test fails |
  | m2: `String(err)` header again | The toString test fails |

- Node 22.18.0: `test/source-location.test.ts` (11) and the located CLI tests (25) pass.

### Other open PRs

- #409 (U2a) and this PR both edit the status line (line 3) of `docs/adr/0072-source-locations.md`. `git merge-tree` reports a content conflict there. Whichever merges second needs a one-line merge that combines "U1 実装済み" and "U2a 実装済み".
- #374 touches `README.md` in another section (stacked on #372). #406, #373 and #372 share no files with this PR.

## Verdict

converged: **yes** (Blocker 0 / Major 0 / Minor 2 / nit 1)
