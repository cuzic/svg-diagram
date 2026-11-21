# PR #409 review (Opus, round 2)

Target: `feat/source-locations-u2a` @ `78cd1c6cf1a6a06fbc4d2462b13d2389ef8914ca`

## Conclusion

All round-1 findings are fixed or deferred as the spec allows. I applied the round-1 mutations again, and the new tests catch each one. M1: replacing the `atBand` in `ctx.stack` with a plain call fails both new handler tests (the too-wide stamp and the duplicate anchor). m1: letting the group overwrite the marks of caption, table, chart and banner fails the all-examples test in both `checkDiagram` and `renderDiagram`. m2: putting back the immediate-connect fill fails the new connector test, and dropping the spread's symbols in `resolveConnect` fails 7 tests. The m2 decision (a connector keeps only its own input mark, for immediate and deferred connectors alike) is now how the code works.

The merge of main is clean. `git show --remerge-diff f888580` shows only the ADR 0072 status line, resolved to `決定・U1・U2a 実装済み(…)` with both review histories kept. Main has since gained #410 (ADR 0072 D3 text only), and it merges cleanly.

U1 and U2a work together correctly. I ran `check` (text and `--format json`) and `build` on main and on this branch with five sources: a string thrown from `raw({draw})`, an `Error` thrown from `raw({draw})`, a too-wide stamp in a nested group, a duplicate anchor id, and a string thrown from `define()`. The output is the same byte for byte, including `✗ P/err.ts:3:90: boom-error`, the plain `✗ P/str.ts: boom-string` and the `findings` JSON. Nothing is wrapped twice. `asError` wraps a non-`Error` once in `atBand` / `throwAtDiagram`, and U1's `locateError` wraps only when it gets a non-`Error`, so it now leaves the wrapped value alone. The wrapper's stack has only package frames, so U1 finds no location, just as it found none for the bare string before. CI is green on the head SHA. `pnpm typecheck` and `pnpm lint` pass locally.

## Previous round

- M1 (Major, `ctx.stack` error tagging untested): fixed. Two handler tests, confirmed by the mutation.
- m1 (Minor, all-examples test exact only for bands with an id): fixed. `expectedBands` matches inputs to laid-out bands one by one, by order and type, with a reasoned list of generated bands. Confirmed by the mutation.
- m2 (Minor, connect fills unexercised and inconsistent): fixed by removing both fills, with a comment that the spread carries the mark. The new test covers marked and unmarked connectors, immediate and deferred. Confirmed by the mutation.
- m3 (Minor, ADR status-line conflict with #407): fixed in the merge.
- n1 (nit, non-`Error` throws become `Error`s): documented in README. See n1 below for the wording.
- n2 (nit, wrapper rows of box cells carry the container's mark): deferred to U3 as the spec says. The test now names this case (`areas` / `grouprow` box cell → synthetic row owned by the container).

## Findings

### n1 (nit): the README sentence says `check` shows a throw from drawing, but `check` never draws
- `README.md:1307`: 「図のレイアウトや描画で `throw 'x'` のように `Error` 以外の値を投げると、… `check` や `build` の `✗` の行にメッセージが出る。」
- `check` does not run `raw({draw})`. My `str.ts` probe gives only an `a11y-no-title` warning under `check`, and `✗ … boom-string` only under `build`. The sentence is also true on main, so for CLI users this is not a new behaviour. The visible change is for library callers (round 1 n1).
- Fix (optional): 「レイアウトで(`build` では描画でも)…」. Or leave it until the U2b CHANGELOG line.

## Verdict

converged: yes (Blocker 0 / Major 0 / Minor 0 / nit 1)
