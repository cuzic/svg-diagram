# svg-diagram PR #459 round 2 (head 967798fd)

Verdict: **converged.** No Blocker or Major remains.

## Fix verification
- M1 (freeze): `Object.freeze(def)` in `lib/plugin-bands.ts` after the stamp and check. The test shows assigning to `internal` throws a TypeError. Removing the freeze fails that test.
- M2 (kind regex): the regex is applied and throws `BandError` (phase `definition`). The test covers `a:b`, spaces, uppercase, a leading digit and the empty string. Removing the check fails the test.
- m1: `childrenOf` in `lib/band-children.ts` throws a `BandError` (phase `layout`) naming the plugin and "U2〜U3". The error carries the source location. The Node and browser renderers are both tested. Removing the guard fails the test.
- m3: optional keys are added only when set (`reveal: 0` is kept). A `type`, `id`, `scope`, `reveal` or `until` key in the `build()` result throws. Mutations for both fail their tests.
- m4: `build()` must return a plain object (a null prototype is accepted). One mutation survives. Removing `!Array.isArray(data)` makes no difference because the prototype check already rejects arrays. It is an equivalent mutant and the line could be dropped (Nit).
- m5 and m6: the audit now covers root `*.ts`, `lib/**/*.ts` and `lib/**/*.js` (`deck-viewer`), plus bare `import './x'` side-effect imports. The fixture records `{count, reason}` per file.
  - Mutations that now fail: changing a count, adding an effect to an already-listed file (`wrap.ts`), adding a new root file, adding a bare import, and removing the root-file scan.
  - After `pnpm build`, every `sideEffects` path exists in `dist` (357 JS files). I removed `dist` afterwards.
- The PR body states the U3 `sanitizeBody` deferral. I checked the README and ADR text in the diff, not the PR body itself, which I could not see.

## Regression checks
- `tsc` and `lint` pass. The 30 tests in boundaries, side-effects, plugin-bands, public-exports and package pass.
- The full suite has 8 failures, exactly the same 8 font, emoji and examples-lint tests as main. The 9th round-1 test was a flake. `git status` was clean afterwards.
- `pnpm golden` fails only on `examples/icons.ts`, the same as main. The `bundle-size` budget still passes (1,068,967 B against a 1,121,847 B limit).
- Round 1 mutations a to h and my own were killed in round 1 and are not re-run here. The ones that touch round 2 code were re-run (list above).

## The "font cache location changed" claim
- **There is no such change in the pushed commits.** `git diff 0a0f6999..967798fd` touches only the 11 files listed below. None is a font, cache, helper or CLI-test file, and `git diff origin/main..HEAD` has no cache edit either. The files are README, the ADR status line, `docs/reviews/pr459-round1.md`, `lib/band-children.ts`, `lib/band-error.ts`, `lib/plugin-bands.ts`, `package.json`, `scripts/side-effects.ts`, `test/fixtures/side-effects.json`, `test/plugin-bands.test.ts` and `test/side-effects.test.ts`.
- So either Codex reverted that change before committing, or it applies to its local environment only. Rendering and goldens are unaffected, and nothing writes outside temp dirs in this head.
- The new audit scans the repo root and `lib/`, so a stray generated `.ts` or `.js` file there would make `side-effects.test.ts` fail. My full run left the tree clean, so it is not triggered now. Ask Codex to confirm that nothing is left untracked, and to drop the claim from the PR body if it is untrue.

## Minor and Nit
- Minor: the freeze is shallow, so nested objects such as `verify` stay mutable. Deep-freeze them or record the limit in a comment.
- Nit: `import x = require()` and similar remain out of scope for the audit.
- Nit: the redundant `Array.isArray` check noted above.
