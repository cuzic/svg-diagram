# PR #505 review (Opus, round 2)

Target: feat/deck-figure-text-size-u2 @ fff6c2b6

## Conclusion
All three round-1 Majors are fixed. I checked each one by its behaviour and by mutation. The new "swap the band's definition" design is scoped to each band value, not to a registry. It leaves no module-level state, and document figures stay byte-identical, also when a deck renders at the same time or a deck render throws. `./browser` is back to main's size and CI is green. Four small issues remain: a stale ADR note, a type-name coupling that can throw on a caller's own `venn`/`cycle`/`concentric` part, and two guards with no failing test.
converged: yes.

## Previous round
- M1 resolved. `render-deck.ts` and `pptx-deck-diagram.ts` now always pass `grow` when there is a room, and the narrow-column success path calls `grown(...)`. When I put back the round-1 code (fill only; `return first`) in serve, in the CLI and in the narrow path, the parity fuzz fails each time. My own random parity fuzz (19 decks, 95 slides, 37 grown figures, fill/width × alone/own width/fixed/auto/two figure columns, Latin and katakana labels, frames, links, side labels) found 0 size or warning mismatches between serve, the full edge, the selected edge and the CLI. The one exception is `text-mid-word-break`: only serve and the CLI report it, and the PR does not cause that (the same warning comes with growth disabled).
- M2 resolved. `pnpm bundle-size` gives `./browser` 1,089,045 (budget 1,090,560, 1,515 bytes of headroom). `origin/main` (8a617463) is already merged into the head, so the trial merge is the head itself. `spec-selective.ts` no longer imports `flow-grow.ts`. The `cycle` package budget is back to 73,000 / 96,000, and `check-package-bundles` passes (cycle 60,327 / 81,475).
- M3 resolved. Each of the five round-1 mutations now fails a test: edge `grownColumns`, edge `drewNarrow`, edge new-rule rejection, CLI column grow, and `askTextSize` in the `specToDiagram` fallback. So do removing `growParts` from serve or from the selected edge, removing `askTextSize` from `planFigureEdge`, and removing the height guard.
- m1 resolved in part. The ADR now records the k < 1.4 rule and the 22px cap, but the same note describes a design the code does not have (m1 below).
- m2 resolved. `textSize` is gone from `CycleOpts`/`VennOpts`/`ConcentricOpts`. `cycle([...], {textSize: 22})` in a document renders byte-identical to `cycle([...], {})`, because only the swapped definition reads `textSize`.
- m3 resolved. The column test is back to the mixed advice (a refused long-Latin cycle plus a table). The duplicated line is now a test that a refused cycle still gives the U1 warning.
- m4 resolved by reading: the CLI now prints `r.verdict.warnings` of the drawing that `growColumnFigure` returns (`pptx-deck-diagram.ts:88`). It has no test; see m3 below.
- n1 resolved. The centre-check mutations of `concentricFits` and `vennFits` now fail a test, and the framed cycle is in the ADR note.

## The swapped definition (what I checked)
- **Scope**: `growBand` does `Object.assign(band, {textSize})` and `defineProperty(band, DEF, grownDef(def))` on the one band value. `grownDef` spreads the definition into a new object and changes no shared definition. The band is always fresh: `specToDiagram` builds new bands on each `draw`, and `growParts` maps to new part objects whose `build` wraps the original one. `FULL_DEFINITIONS` and `definitionFor({type: 'venn'})` are the same objects before and after deck renders. Another `venn(...)` value keeps the original `[DEF]`.
- **Concurrency and exceptions**: I ran `Promise.all([renderDeck(deck), renderDeck(deck), 12 document renderSpec calls, full edge])`. The 12 document SVG hashes were identical before, during and after, both decks were identical, and a deck figure that fails (`venn` with no sets) changes nothing for the next document render. Nothing needs restoring, because no state exists outside the band.
- **"No module-level state" (ADR 0074 / ADR 0080 D9)**: kept. `FITS` is a constant table, there is no registration, and the grown definition travels on the band value, as D4 intends (`[DEF]` is copied by `{...band}`).
- **Edge and selective bundles**: the selected edge wraps whatever `[DEF]` the selected part's `build` attaches. The full edge falls back to `definitionFor`, which `spec.ts` already brings in. Definitions are never mutated, so freezing them would not matter. A frozen band would throw (`Object.assign`), but no spec path builds frozen bands, and `.ts` sources are never grown.
- **Document byte identity**: `pnpm golden` gives 202 of 203 up to date. The one exception, `icons.ts`, drifts in this environment, the same as in round 1, and CI `golden` passes.

## Findings

### m1 (Minor): the ADR implementation note describes a hook registered in `lib/flow-definition.ts`, but the code has no such hook
- Evidence: `docs/adr/0085-deck-figure-text-size.md` (U2 note, "内部の指定") says the deck "同時に `lib/flow-definition.ts` のフックへ引き上げの実装(`lib/flow-grow.ts`)を登録する" and "./browser: main に +105 バイト". At fff6c2b6, `lib/flow-definition.ts` is unchanged, no hook is registered (that would be module-level state), and `./browser` is +0. The PR body describes the per-band `[DEF]` swap correctly.
- Fix: rewrite that bullet to say what the code does: `growBand` replaces the band value's own `[DEF]` with a wrapped copy, there is no registration, and `./browser` is unchanged.

### m2 (Minor): growth is chosen by type name, so a caller's own part named `venn`/`cycle`/`concentric` gets the built-in fit tests and can throw a raw TypeError
- Evidence: `growBand` wraps any band whose `type` is in `FITS`, whatever its definition. The selected edge takes its parts from the caller (ADR 0080 D9), so the caller can supply its own part under one of these names. I attached `growBand(band(customDef, {type: 'venn', ...}), 22)` to a custom definition whose `laid` is not a `LaidOutFlowShape`. Its `layout` then throws `TypeError: Cannot read properties of undefined (reading 'flatMap')`. Before this round, growth lived inside the built-in definitions and could not reach such a part.
- Fix: wrap only the built-in flow definitions. For example, mark them with an internal flag that `growBand` checks, or have `grownDef` keep the base drawing when `fits` throws.

### m3 (Minor): two guards have no test that fails when they are removed
- Evidence: I removed the "no new rule id" check in serve's `grown()` (`lib/deck-render-figure.ts`, the `ruleIds(...).some(f => !flags.includes(f))` clause) and the same check in `growColumnFigure`. In a separate run, I made the CLI print the first drawing's column warnings again (the round-1 m4 code). All 33 tests in the three deck-text test files passed each time. Only the edge writer's copy of the check has a test, which injects a finding.
- Fix: give serve and the column path the same injected-finding test, for example a stubbed rule that fires only when `textSize` is set. Add one CLI column case where the grown drawing drops a warning that the first drawing had.

### n1 (nit): calling `growBand` twice wraps the wrapper
- `growBand(b, 22); growBand(b, 18)` nests `grownDef(grownDef(def))` and measures twice as many candidates. No current path does this, because every `draw` builds fresh bands. An early `if (band.textSize !== undefined)` return, or unwrapping, would make it idempotent.

## Other checks
- CI on fff6c2b6: `test (1/3)`, `test (2/3)`, `test (3/3)`, `golden` and `ooxml-xsd` all pass.
- `test/side-effects.test.ts` passes (it failed locally only while my scratch files were in the root; they are removed).
- Open PRs: none of the other open PRs (#494, #454, #444, #374, #373, #372) touch `flow-grow.ts`, the deck renderers or the flow band definitions.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 3 / nit 1)
