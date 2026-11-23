# svg-diagram PR #459 round 1 review (head 0a0f6999)

Verdict: **Approve with Majors to fix. No Blocker, no leak found.** Round 2 is needed only for M1 and M2.

## What I verified
- `pnpm typecheck` and `pnpm lint` pass. The 24 tests in band-boundaries, side-effects, plugin-bands, public-exports and package pass.
- The full suite fails on 9 tests in the PR and 8 on main.
  - The 8 are the same on both: font and Chromium tests, the examples lint, and the emoji tests.
  - The 9th (the `concentric 'stack'` bounded-time test) failed only because I ran the PR and main suites in parallel. Run alone it passes 26/26. This is flaky timing, not a regression.
- `pnpm golden` fails only on `examples/icons.ts`. It fails identically on main (font). No files under `examples/out` changed in the PR.
- Pure relocation:
  - I regenerated the export names of `dsl.ts`, `dsl-pure.ts` and `web.ts` on origin/main and diffed them with the PR's `public-exports.json`. They are **identical**.
  - Browser bundle: main 1,068,382 B, PR 1,068,426 B (+44 B).
  - I did not independently recompute the 194 PPTX/SVG hashes; I checked golden instead.
  - The moved canvas code is line-for-line the same as the old `lib/canvas.ts`, apart from the import paths. The leftover `lib/canvas.ts` is the 60-line placement part.
  - `versus`: `located()` moved from dsl-pure into `compose/versus.ts`, and the exported value is the same.
- Type probes of my own, run against the widened `add()`:
  - `{type:'boxx'}`, `{type:'a:b', id}` (a plain literal with no DEF) and `{type:'foo'}` are all rejected.
  - `connect('zz', ...)` and `connect('rr', ...)` are rejected, including in the array form.
  - `r.s99` is accepted (as specified).
  - An external `BandValue` is not assignable to `Band`.
  - `d.bands` is still `Band[]`.
  - I swapped `AddInput` back to `BandInput` to check whether `{type:'box', titel:'y'}` is a regression. The excess-property gap is identical before the PR, so it is not one.
  - Widening is limited to `` `${string}:${string}` `` plus the DEF symbol, and core `Band` totality is intact.
- Copies: `copyBand` and `cloneData` keep the def, so `[EXTERNAL]` survives (it sits on the shared def object).
- Mutations (all killed by the stated test). Ones from the Issue:
  - (a) fails R1.
  - (b) fails R2.
  - (c) fails three tests.
  - (d) fails the side-effects test.
  - (e) fails the trusted-fields test.
  - (f) fails the build-error test.
  - (g) fails `public-exports`.
  - (h) is covered by the 1 KB test. I ran the script with `SVG_DIAGRAM_BROWSER_BUDGET_BYTES=1024` and it exits 1.
- My own mutations (all killed):
  - Drop the `[EXTERNAL]` stamp: killed.
  - Skip the minor check in the apiVersion gate: killed.
  - Remove `located`: killed.
  - Drop the `nodeIds` refusal: killed.
  - Drop the `rectsQualified` refusal: killed.
  - Drop the `svg-diagram` reserved id: killed.
  - Remove ui.js from the package.json array: killed.
- The boundary test detects R1 violations from a plain import, a re-export (`export ... from`), a dynamic `import()`, `export *`, and a nested directory. It does not flag `import type` from `compose/`. That is acceptable because the import is erased.

## Findings

### Major
**M1. The refusal of external definitions is checked once and not enforced afterwards.** `lib/plugin-bands.ts:22-24`, `lib/band-def.ts:131`.
- The stamped def is a plain mutable object shared by every band the builder makes. Any code that reaches `defOf(b)` can run `defOf(b).internal = true` after the check. I confirmed `Object.isFrozen(def) === false`. The check also never re-runs.
- Fix: `Object.freeze(def)` in `builder()`, after the stamp and the `assertTrustedBandFields` call. Add a test that assigning `internal` to `defOf(b)` throws in strict mode.
- A later unit that registers or consumes a def (U2) should re-assert on the stamped def, not trust this early check.

**M2. `kind` (the band key) is not validated.** `lib/plugin-bands.ts:44`.
- The plugin `id` gets a regex check, but `bands` keys do not. I confirmed that `'a:b'` and `'Bad Kind'` are accepted, giving types `p:a:b` and `p:Bad Kind`.
- Two things break: the `Builders` key type, and the `type.indexOf(':')` split used by `assertTrustedBandFields` in `band-def.ts`, which assumes the first colon.
- Anchor refs also parse on `:`, so a `:`, `.` or `#` in a kind would be misread downstream.
- Fix: require `^[a-z][a-zA-Z0-9-]*$` (or a similar rule) on the kind, and add a test.

### Minor
- **m1. Unfriendly error when a plugin band is rendered.** `diagram().add(pluginBand)` then `renderDiagram` throws `TypeError: CHILD_BANDS[band.type] is not a function`. The PR allows non-rendering, and the ADR defers the host path to U2/U3, but a clear `BandError` such as "プラグインの帯の描画は未対応（U3）" would be better.
- **m2. The `<script>` gate is deferred to U3 (the ADR U3 row says so), but the PR text and tests do not say so.** My probe (a def whose `emit` returns `<script>`) never reaches the sanitizer. Say "gate deferred to U3" in the PR body so the ADR/PR link is explicit. No code wired in yet, so nothing leaks.
- **m3. `{...data, type, id, scope, reveal, until}` always creates the keys `id`, `scope`, `reveal` and `until`, even when they are `undefined`.** It also overwrites any same-named field that `build()` returned. In my probe `build` returned `id`, `scope` and `extra`, and only `extra` survived. Fix: only add defined keys, and decide (document) whether `build` output may use those names (reserve them, or throw).
- **m4. `build()` returning a non-object (`null`, a number) is accepted.** `build: () => null` yields `{type:'p:n'}`. Throw a `BandError('build')` when the result is not a plain object.
- **m5. `sideEffects` only covers `lib/**`.** `tsconfig.build.json` also emits the root `*.ts` files (`build-diagram.js` and others). They are not in `exports`, so this does not matter today, but a comment in `scripts/side-effects.ts` that the root CLI files are out of scope would help. The list is otherwise correct: it includes `lib/present/ui.ts` and `compose/canvas`, the array form is used, `false` is not used, and the test compares the package.json array with the AST list.
- **m6. The audit counts sites, not files, and the `.json` fixture stores prose reasons.** It reads fine, but a change in the count at an existing file would not fail the test (a new effect inside an already-listed file passes silently). This is acceptable for a file-level `sideEffects` flag.

### Nit
- n1. The budget (1,121,847 B) is +5% of the PR's measured 1,068,426 B, not of the ADR's 1042 KB. The ADR table (line 203) still reads "1042 以下". Add one line to D12 that the U1a budget is +5% of the measurement, 1,121,847 B.
- n2. `purity.ts`'s `importsOf` is regex-based. It would miss `import x = require()` and imports whose specifier spans lines in unusual ways. This is the existing helper, so ignore for now.
- n3. The ADR status line was shortened and dropped the "Q1〜Q18 決定済み" detail. Keep a link to the decision table.
- n4. `bundle-size.ts` reads the env override with no test of an invalid value. Trivial.

## Conformance table (Issue #457)
- Composers moved and the relocation is pure: yes. `callout`, `bracket`, `branch`, `stat` and `stateMatrix` are untouched.
- R1, R2 and the `CORE_OWNED`/composer accounting: yes. The test builds a temp tree and checks it can fail.
- The sideEffects audit: yes. The AST path is covered by a fake-file false-negative test (listener, initializer, control, await, class static, tagged template).
- Bundle size: yes (wired into CI and `package.json`).
- `PluginDef`, `pluginBands`, `EXTERNAL`, `BandError`, the apiVersion rule, id rules, `located`: yes, except M1 and M2.
- `svg-diagram/plugin` type-only: yes. The `Object.keys` of the module is empty and the `exports` entry is correct.
- The `add()` widening (follow-up): yes, types only, limited to namespaced external values, with type tests.
