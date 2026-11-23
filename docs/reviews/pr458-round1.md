# svg-diagram PR #458 round 1 review (head 1dae5aa8, ADR 0080 U1a-1 / Issue #456)

Verdict: no Blocker, no Major. Minor x3, Nit x3. Approve once the Minors are decided.

## Verified
- typecheck, lint clean. Full test: PR has the same 8 failures as main (fonts x4, emoji x2, layout-* budget, lint --strict examples, tspan lint); no new failure. pnpm schema: no diff.
- Acceptance 1-10 each have a test. Mutations (a)-(g) all killed by the tests the PR names. My extra mutations all killed:
  e2 (withLegacyTables mutates base), table-before-DEF precedence, legacy lookup via `in` instead of hasOwn (assertNoShadowedRows), plain() not recursing into arrays, removing the layout.ts child-walk guard, layoutHandlerFor consulting LAYOUT_HANDLERS before DEF, coreDispatch not throwing.
- Behaviour unchanged: `pnpm golden` (drift+rebuild) output is line-identical between main and PR in my environment (same single local font drift on both). Fallback removal is safe: on main, an unknown type (`x:y`, `Box`, `toString`, `constructor`, nested in group or top-level) already threw in layoutBands (`CHILD_BANDS[band.type] is not a function` / `bs is not iterable`) before layoutHandlerFor ran, so the box fallback was dead for unknown types. The PR only improves the message. `raw` and every Band['type'] have a LAYOUT_HANDLERS row (ALL_BANDS_HANDLED compile-time check plus test 10). layoutHandlerFor's only callers are layout.ts:102 and :382.
- Purity: withLegacyTables copies each table shallowly at injection, returns a fresh object, never touches base; no module-level mutable state (core-purity test passes). Module-level `layoutDispatch` is built once from LAYOUT_HANDLERS after its definition; nothing mutates LAYOUT_HANDLERS afterwards.
- Leaks: none found. Diff, tests, commit messages and PR body contain no real labels or names; only the owner's normal git author. 

## Minor
1. lib/band-def.ts:98 `band()` returns `{...data, [DEF]: def}`. Spread drops non-enumerable properties and the prototype of `data`, e.g. the `.left/.right/.at` handles that `withHandle` (lib/dsl/shared.ts:18) defines non-enumerably on `box({id})` results. ADR D4 sketches `band(boxDef, boxDef.build(input))`; if a migrated constructor calls withHandle before band(), handles vanish. Issue text says "copy of the data object", so this is spec-conformant, but it is a trap for the first migration PR. Fix: `const out = copyBand(data); out[DEF] = def` semantics (copy descriptors, then assign DEF), or document that handles must be attached after band(), and add a test.
2. lib/dsl/diagram.ts:142 cloneData copies only the current-version `DEF`. A band carrying `Symbol.for('svg-diagram.def/9.9')` loses it through detachData, so the "API version mismatch" error silently becomes "no definition" at layout. Also arrays carrying DEF lose it (arrays return early at :131; probably irrelevant). Fix: copy every own symbol key for which the description starts with the def prefix (export `isDefKey`, or a `copyDefKeys` helper from band-def.ts), and add a test for 9.9 through detachData.
3. lib/layout.ts:102 the added guard `!Object.hasOwn(CHILD_BANDS, b.type)` is a stop-gap: its only job is to make the unknown-type error appear before `childrenOf` throws a nameless TypeError. For a future [DEF] band whose type is not in CHILD_BANDS, layoutHandlerFor passes and `childrenOf(b)` (lib/band-children.ts:67) then throws `CHILD_BANDS[band.type] is not a function`. Out of scope for U1a-1, but leave a comment at the guard pointing at D4 (`children` from the def) so U1a-2/U8 replaces it. Other pre-layout walkers (walkBands, rewrite, rules, idsIn) still give nameless errors for unknown types; add() accepts an unknown type silently (checked: `diagram().add({type:'x:y'})` succeeds, error comes at layout).

## Nit
- PR body is stale: says 9 failures with 1 Open question about untested-exports.json, which the owner comment resolved and the second commit applies (now 8 env failures, 0 open). Update before undrafting.
- lib/band-def.ts: `plain()` keeps accessor descriptors as is (getter results are not stripped) and returns non-plain-prototype objects by reference (documented). Fine now; mention in the JSDoc.
- lib/dsl/shared.ts: `import {copyBand as cloneBand}` + `export {cloneBand}` works; a direct `export {copyBand as cloneBand} from '../band-def.ts'` would read simpler (but then local use needs an import).

## Notes (no action)
- defOf version scan covers own symbols only; inherited DEF (prototype) is read but not version-checked. copyBand keeps own keys, so fine.
- isDefKey uses startsWith('svg-diagram.def/'); `0.1` vs `0.10` are distinct keys, correctly treated as different versions.
