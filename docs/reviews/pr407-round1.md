# PR #407 review (Opus, round 1)

Target: `feat/source-locations-u1` @ `b05b6856ca46892d3bdc58a52b68a65a8aecd34f`

## Conclusion

The core of U1 holds up. Header and caret parsing, the TypeScript display-width to UTF-16 conversion, CallSite capture, `via`, `?svg-diagram-fresh` stripping, symlinks, Japanese and space paths, `ERR_MODULE_NOT_FOUND` from relative and package specifiers, and the json/github/sarif shapes all gave correct results on hand-made sources under Node 26.13 and Node 22.18.0. The VS Code extension (`src/check.ts`) stays compatible. **converged: no.** There are two Majors. First, under `check --drift --rebuild` (cache on by default) some errors are placed in the package's own `drift-cache-io.ts`. Second, when the error is in another file, the `✗` line in text output no longer names the figure that failed.

## Previous round

None.

## Findings

### M1 (Major): package files other than the listed CLI entries are taken as the user's file, so `--drift --rebuild` places errors in `drift-cache-io.ts`

D3 says frames inside the package are skipped (`lib/`, the CLI entry files, `node:`), and when the checked source has no frame, the fallback is "the user's other file (`_parts.ts` など)". `lib/source-location-io.ts:13-17` skips a hand-written list of entry names. That list leaves out the other package files at the root, `drift-cache-io.ts` and `drift-pool.ts`. `check-diagram.ts:368` runs `importDefine` inside `drift-cache-io.ts`'s `recordReads` whenever `--drift --rebuild` uses the cache, which is the default. An import error with no frame in the source then keeps the async frame `recordReads (drift-cache-io.ts:84)` as the only frame that is not skipped. That frame becomes `loc`.

Evidence (ran, Node 26.13, temp project next to the clone). `src/nested.ts` imports `./_mid.ts`, which imports a non-existent `./_missing-dep.ts`. `src/usesjson.ts` imports a malformed `d.json`:

```
$ node ../repo/check-diagram.ts --format json src/nested.ts src/usesjson.ts                 # no location (correct)
$ node ../repo/check-diagram.ts --drift --rebuild --format json src/nested.ts src/usesjson.ts
{"file":"src/nested.ts", ..., "location":{"file":"../repo/drift-cache-io.ts","line":84,"column":22}}
{"file":"src/usesjson.ts", ..., "location":{"file":"../repo/drift-cache-io.ts","line":84,"column":22}}
$ node ../repo/check-diagram.ts --drift --rebuild src/nested.ts
✗ ../repo/drift-cache-io.ts:84:22: Cannot find module '…/src/_missing-dep.ts' imported from …/src/_mid.ts
```

With `--no-cache` the location is correctly absent. This is a wrong location in the tool's own file, and `--format github` / `sarif` would annotate that file. The same happens in the `--jobs` pool children (same entry point), and in an installed package (`dist/drift-cache-io.js`). A hand mutation that empties the list *is* caught by 4 CLI tests. So the gap is in what the list covers, not in test coverage.

Fix: skip every module at the package root, not a list of names. That means files whose directory is `path.dirname(libDir)` and whose extension is the CLI's, together with `libDir` and below. That covers `drift-cache-io`, `drift-pool` and any future root helper, and it still leaves `examples/` and `test/` as user files, as D3 requires. Add a CLI test: `check --drift --rebuild --format json` on a source whose nested import is missing should give no `location`.

### M2 (Major): when the location is in another file, the `✗` line drops the figure that failed

`check-diagram.ts:185` and `build-diagram.ts:112` print `formatBuildError(loc ?? file, err)`. When `loc` is in another file (a broken shared `_parts.ts`, a helper that throws at top level), the line names only that file. Before this PR it was `✗ <source>: <message>` (ADR 0013). D5 and Issue #405 define the located form only as `✗ src/a.ts:12:5: …` for the source being checked. Neither says the failing source may disappear, and the PR does not raise it as an Open question.

Evidence (ran). Two figures import the same broken `_bad.ts` (`export const y = 1 +;`):

```
$ node ../repo/check-diagram.ts src/usesbad.ts src/usesbad2.ts
✗ src/_bad.ts:1:21: Expression expected
✗ src/_bad.ts:1:21: Expression expected
2 件中 2 件が検査できなかった
$ node ../repo/build-diagram.ts src/usesbad.ts src/usesbad2.ts
✗ src/_bad.ts:1:21: Expression expected
✗ src/_bad.ts:1:21: Expression expected
```

From this output the user cannot tell which SVGs were not built or checked. Before, they could. JSON keeps `file` (correct), so the extension is not affected. Text and `build` output, which CI logs and scripts read, lose information.

Fix: keep the checked source in the line when `loc.file !== source`. For example `✗ src/usesbad.ts: src/_bad.ts:1:21: Expression expected`, which keeps both the figure and a clickable `path:line:col`. Or put the source in a suffix such as `（src/usesbad.ts の読み込み）`. The wording is a public-output decision. Choose one with the owner (or record it in the PR's Open questions), then pin it with a test that `check` and `build` print the same line.

### m1 (Minor): a mistyped side-effect import (`import './x.ts'`) gets no location

`IMPORT_SPECIFIERS` (`lib/source-location.ts:94`) matches only `from '…'` and `import('…')`, as D3 lists. `export * from '…'` works. The bare `import './_side-typo.ts';` does not (ran: `✗ src/side.ts: Cannot find module …`, no line). The fallback is safe (no location), so this is a gap, not a wrong answer. Fix: also match `\bimport\s*(['"])` at statement position, and add a unit case.

### m2 (Minor): the global `prepareStackTrace` calls the error's own `toString()`. A throwing `toString` crashes `SVG_DIAGRAM_DEBUG=1` runs with a raw stack

`lib/source-location-io.ts:23` builds the header with `String(err)`. V8's default formatter uses the internal Error-to-string and never calls a user `toString`. Ran:

- `class E extends Error { toString() { return 'PRETTY'; } }`: the debug stack header becomes `PRETTY` instead of `Error: custom`.
- If `toString()` throws, every read of `err.stack` throws, because V8 calls the hook again after a failed format. `locateError` catches it, but `formatBuildError` under `SVG_DIAGRAM_DEBUG=1` does not. The CLI then dies with Node's uncaught trace (`at Error.prepareStackTrace … at formatBuildError`), and the remaining files are never checked. On `origin/main` the same source prints `✗ src/tostr.ts: custom` and a normal stack.

Fix: `let head; try { head = Error.prototype.toString.call(err); } catch { head = 'Error'; }` (or a similar safe form). Also guard the stack read in `formatBuildError`.

### n1 (nit): with `--enable-source-maps`, DEBUG and uncaught stacks are no longer source-mapped

The ADR accepts this for CallSites and fixes the location via `findSourceMap`. The text that the hook returns still shows generated positions, so `SVG_DIAGRAM_DEBUG=1` stacks for source-mapped helpers are less useful than before. The hook could format mapped positions when `process.sourceMapsEnabled`, or the README sentence on `SVG_DIAGRAM_DEBUG` could mention it.

### n2 (nit): a thrown non-Error that already has a stack loses its frames

`locateError` wraps every non-`Error` in `new Error(String(e))`. For an object passed through `Error.captureStackTrace(o)` and thrown, the user frames on `o.stack` are discarded. The result is no location and the message `[object Object]` (the message is pre-existing). Reading `stack` from the original value when it is a string would keep the location. This is rare, so it is a nit.

### Checked and found correct (no finding)

- Message ending in `:<digits>` (`'/etc/passwd:12'`, `'aspect must be 16:9'`), and a multi-line message that imitates a header plus `^`. Neither is read as a header, because line 0 is `Error: …` and the caret check holds.
- Syntax error with a tab and wide characters in `日本 語/syn tax.ts` gives `2:29`, which is right. `enum` gives `2:1`. A missing named export gives the V8 caret, not converted. A mistyped relative import gives the specifier column. `export * from` with a typo is located. A syntax error in an imported helper, and in a helper loaded by `import()` inside `define()`, gives `location` in that helper.
- Throw in a same-file recursive helper: `loc` is the throw, and `via` holds the callers in order, including the `.map` arrow. Throw in an imported helper: `loc` is the call in the source. Frozen error: falls back to the text frames and is still located. `throw 42` / `throw 'boom'`: no location. Source opened through a symlinked directory: location is correct and uses the logical path.
- Layout throws (`connect` to an unknown id, bad TeX in `math()` raised in `define`) keep no location, or get the user's `define` line. Neither gets a lib or CLI location in the normal path.
- Node 22.18.0 (official tarball, checksum verified): the PR's `source-location` and located CLI tests (21) pass, and the hand-made cases above give the same output as on 26.13. The CallSite methods, `process.sourceMapsEnabled`, `findSourceMap().findOrigin`, and `import.meta.dirname/filename` all exist there.
- The pure core `lib/source-location.ts` imports only `node:path` / `node:url`, which `core-purity` allows. `error-format.ts` uses it only as `import type`, so nothing reaches the browser entry. `source-location-io` is registered in `SHELL`.
- SARIF `partialFingerprints` stay equal across `--write-baseline` / `--baseline` runs (the WeakMap keeps the fingerprint from before the suffix). The baseline fingerprint itself is unchanged.
- The VS Code extension `src/check.ts` reads only `file`/`line`/`message`/`rule`/`severity`, so the added `column`/`location`/`via` are ignored safely.
- Golden: CI `golden (examples/out)` passes. The PR does not touch rendering.

### Mechanical verification

- `gh pr checks 407`: golden, test 1/3, 2/3 and 3/3 all pass.
- Hand mutation (reverted): the `cliFiles` list emptied. 4 CLI tests fail (`build: a source without a default export…`, `build failure: the previous SVG stays…`, `check: a thrown string keeps its message…`, `check: a throw during layout is formatted too…`). Coverage of the skip itself is adequate. M1 is about what the list omits.
- Other open PRs: only #374 (gantt) is open, and it shares no file with this PR except `README.md`, in a different section. No conflict is expected.

## Verdict

converged: **no** (Blocker 0 / Major 2 / Minor 2 / nit 2)
