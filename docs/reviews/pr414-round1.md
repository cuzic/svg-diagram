# PR #414 review (Opus, round 1)

Target: `fix/bin-node-floor` @ `ac377c0f0fe8708188cd6d67ffcf840ddef0d80e`

## Conclusion

The change is right and does what Issue #412 asks. `bin/svg-diagram` now checks the Node version on both layouts (source `.ts` and `dist/*.js`). Below 22.18 it prints one line and exits 2. `NODE_FLAGS` is gone, and nothing else in the repo used it. With a fake `node` on `PATH`, I got these results. 22.17.1, 21.99, 18.20 and 9.0 stop with `svg-diagram: Node 22.18 以上が要る(今は vX)` and exit 2. 22.18.0, 22.100.0, 23.0.0, 23.0.0-nightly…, 24.1, 26.13 and 100.0 pass through and run the right script with the arguments unchanged. The new test really runs the script (a copied launcher with a fake `node` first on `PATH`, for both layouts). The two mutations it should catch both fail it. Lowering the floor to 22.6 fails both cases. Checking only in the `.ts` layout fails the `dist` case. The whole of `test/cli.test.ts` passes locally (48/48, Node 26.13), and `gh pr checks 414` is all green (test 1/3–3/3, golden).

No Blocker or Major. There are two Minors. One doc still says the launcher adds `--experimental-strip-types` on 22.6–22.17. The test only covers major 22, so a comparison that rejects 24.x / 26.x would pass CI, which runs on Node 22. There is also one nit on the message.

## Previous round

None.

## Findings

### m1 (Minor): `docs/chatgpt-code-interpreter.md` still claims 22.6–22.17 support through the launcher
- `docs/chatgpt-code-interpreter.md:9`: 「22.18 以上は無指定、22.6〜22.17 は `bin/svg-diagram` が `--experimental-strip-types` を足す」.
- Evidence: after this PR the launcher refuses those versions. A repo-wide grep (outside `docs/reviews/`) finds no other stale claim. README, `AGENTS.md:46` and `package.json` `engines` (`>=22.18`) agree.
- Fix: change the cell to say that Node 22.18 or newer strips the types with no flag, and drop the 22.6–22.17 part. The issue's file list does not include this doc, so make this a one-line follow-up or a scope extension the owner agrees to.

### m2 (Minor): the version test covers only major 22, and CI runs on Node 22
- `test/cli.test.ts`, `bin/svg-diagram (${layout}): requires Node 22.18`: the fake `node` always answers `22 <minor>`.
- Evidence: I mutated the condition to `[ "$maj" -lt 22 ] || [ "$min" -lt 18 ]` (dropping `[ "$maj" -eq 22 ] &&`). With that, real Node 24.11 or 26.13 is refused. Both new cases still passed. CI (`.github/workflows/test.yml`, `node-version: 22` / `22.23.5`) has minor ≥ 18, so the other bin tests would not catch it either. Only a developer on Node 23+ with a minor below 18 would notice.
- Fix: have `run` take the full version (major and minor). Also assert that `21.99` stops and that `23.0` (or `24.0`) passes.

### n1 (nit): the message says what is wrong but not how to fix it
- `bin/svg-diagram:28`: `svg-diagram: Node 22.18 以上が要る(今は $(node -v))`.
- `AGENTS.md:54` asks for one line that says what is wrong and how to fix it. The wording is exactly what Issue #412 specified, so this is not a defect of the PR. Adding a short fix would match the house style better, for example `…(今は v22.17.0)。Node を 22.18 以上に上げる`. If you change it, update the assertion in the test too.

### Notes (no action)
- The `dist/` layout used to run on any Node. Now it is held to 22.18 as well. This is intentional and matches `engines` (`findPackageJSON` already needs 22.14 at module load). It costs one extra `node -p` start per call on the dist path, which is acceptable for a CLI.
- A `node` that prints nothing makes `read` fail, and the launcher exits 1 without a message under `set -e`. A `node` that prints non-numbers makes `[` complain, and the launcher then continues. Both behaved this way before on the source path, and neither happens with a real Node.
- With no arguments or an unknown command, the launcher now checks the version before it prints the usage. That is fine.

## Verdict

converged: yes (Blocker 0 / Major 0 / Minor 2 / nit 1)
