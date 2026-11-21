# PR #415 review (Opus, round 1)

Target: feat/source-locations-u2b @ 89cd2111bfdb9865b91e8ffa2cbf8ef4b22e2b19

## Conclusion

No Blocker and no Major. `located()` follows the D2 rules. The explicit export list matches what `export *` exported before, for both runtime values and types. `check` turns on capture in the right modes, and `locateError` follows the D4 order. The table test covers every band-returning export of `lib/dsl.ts`, including `quadrant.preset`, and checks each one's line and column. Two Minor test gaps remain, plus three nits.

What I checked independently:

- **Export compatibility.** I imported `lib/dsl.ts`, `lib/dsl-pure.ts`, `lib/web.ts`, `lib/spec.ts`, `lib/spec-edge.ts` and `lib/render-source.ts` on main (404e0d1) and on the branch, and listed every export's name, `typeof`, function `name`, `length` and own function properties. All 444 lines match. I built `dist/` on both sides (`tsconfig.build.json`). A type-only import probe of 735 candidate names against `dist/lib/dsl.js` gives the same 30 misses (internal helpers that were never public) on both sides. So no type export was lost or added.
- **Type identity.** A probe in `test/types/` still rejects unknown anchor ids in `connect()` (`@ts-expect-error` holds) for builders, `row()` and `image()` marks. The existing `test/types/ids.ts` passes `tsc -p .`.
- **located() rules.** Builders return no shared or cached objects: I called every fixture builder twice with capture on, and no part or descendant was the same object, so tagging never leaks one call's site into another. `diagram` is exported unwrapped (no double tag). `image` and `math` are wrapped in `lib/dsl/io.ts`. Function `name` and `length` are kept.
- **CLI behaviour (probes outside the repo).** Same-file helper gives `loc` in the helper plus `via`. A part in `_parts.ts` called from the source resolves to the call in the source. A module-level part exported from another source resolves to `✗ src/usesShared.ts: src/shared.ts:2:26`. A box created inside `.map` over several lines resolves to the `box(` line, not to the `group(` or `.map` line. `styled(box)` resolves to the styled call. A literal band inside `row()` resolves to the `row(` call. A missing image inside `row()` resolves to `image(`. A `steps()` connect resolves to the `connect(` line. `build` keeps the old line without a position. A `raw({draw})` throw is unchanged (check does not draw).
- **Capture off.** `box()` costs 0.16–0.36 µs per call on both main and the branch. With capture on (`stackTraceLimit` 50) it costs about 2.4 µs. `check --strict examples/*.ts` takes about the same time on both sides (8.0 s vs 8.2 s on the second run), and the output is byte-identical. The spec parts import the wrapped builders, but with capture off they only pay one extra call and the flag check, and they attach no `SourceRef`.
- **Mutations.**
  - Removing the descendant walk in `located` fails the steps/swimlane/versus test.
  - Skipping the part `SOURCE` in `locateError` fails three tests: two CLI tests and the order test.
  - Adding a new export to a `lib/dsl/*.ts` module without a line in `dsl-pure.ts` fails nothing (m1).
  - Making `check` always capture fails nothing (m2).
- **Checks and conflicts.** CI is green: test 1/3–3/3 and golden. The PR merges cleanly (`git merge-tree`) with #414 (which also touches `README.md` and `test/cli.test.ts`) and with #374 (which touches `lib/dsl/timeline-gantt.ts` but adds no export).

## Previous round

None (first round).

## Findings

### m1 (Minor): a builder added to a `lib/dsl/*.ts` module but not to `lib/dsl-pure.ts` silently stops being public, and no test fails

`lib/dsl-pure.ts` now lists the values by name. The modules are re-exported only with `export type * from './dsl/….ts'`. So a new `export function foo()` in, say, `lib/dsl/charts.ts` is exported **as a type only**, and is missing from the runtime exports of `lib/dsl.ts` and `dist/lib/dsl.js`. The test `source locations: every public DSL function is in the builder table or has an exclusion` enumerates what `lib/dsl.ts` already exports, so it cannot see a function that never got there.

Mutation: I appended `export function zzzPart() { return {type: 'box'} }` to `lib/dsl/charts.ts`. `test/source-locations-builders.test.ts` and `test/pure-exports.test.ts` still pass, and `'zzzPart' in await import('./lib/dsl.ts')` is `false`.

ADR 0072 (結果) promises 「部品の関数を足す人は、そこに 1 行足し、U2b の表に例を足す(足し忘れるとテストが落ちる)」. That promise holds for a missing table row, but not for a missing line in `dsl-pure.ts`.

This is mitigated: `tsc` rejects any use of such a function through `lib/dsl.ts` (TS1362 "cannot be used as a value because it was exported using 'export type'"). A new builder that has an example or a test is therefore caught. Hence Minor, not Major.

Fix: in the same test, compare the value exports of each module that `dsl-pure.ts` imports as a namespace (`textBands`, `sequenceTableSwimlane`, …, `timelineGantt`) with `Object.keys(dsl)`. Every function there must be exported from `lib/dsl.ts` or named in a short "internal, not re-exported" list. Today that list would be empty, since the runtime export sets match main.

### m2 (Minor): nothing pins that `check --drift` / `--covers` / `--docs` without sources leave capture off

`check-diagram.ts:137`: `if (sources.length && !drift && !coversFile) captureSourceLocations(true);` is correct. ADR D2 「取るのは、要るときだけ」 requires these modes not to capture. But replacing the line with an unconditional `captureSourceLocations(true)` keeps all 18 `drift|covers|docs|worker` tests in `test/cli.test.ts` green. The output is identical either way, so only the cost and the D2 rule would regress, unnoticed.

Fix: a small test that runs `check --drift --rebuild` (or `--covers`) on a source whose part fails in layout. The test asserts that the line has no part position, as on main. Or, more simply, a unit-level assertion behind an env hook. Either is fine; the observable form is better.

### n1 (nit): `markPart` walks past already-tagged children

`lib/located.ts` keeps recursing into the children of a child that already has a `SOURCE`. An untagged grandchild under a tagged child therefore gets the **outer** call's ref instead of its nearest tagged ancestor's. This only happens with hand-built or hand-mutated trees, for example `g.children.push({type: 'box', …})` followed by `row([g])`.

Returning before the recursion when `sourceOf(value)` was already set would leave such grandchildren untagged. The layout's `atBand` on `g` would then give them `g`'s position, which is the nearer one. This needs no test change. The current behaviour is still inside the ADR wording ("SOURCE のない物に外の呼び出しの SourceRef").

### n2 (nit): the README sentence covers only the part case

The new sentence in the README `check` section says that errors caused by a part point at the call that made the part. An error with no part (for example `diagram({spotlight: 'missing'})`) points at the `diagram()` line. Half a sentence on that would match what the CLI test asserts.

### n3 (nit): go-to-definition lands on the wrapper

`export const box = located(textBands.box)` makes an editor's "go to definition" on `box` (from `svg-diagram` or `lib/dsl.ts`) stop at `dsl-pure.ts` / `dsl-pure.d.ts` instead of the builder and its JSDoc. Signatures and overload docs are preserved through `typeof`. This is inherent to ADR D2's design and needs no action. It is noted only so that nobody reports it later as a regression.

## Verdict

converged: yes (Blocker 0 / Major 0 / Minor 2 / nit 3)
