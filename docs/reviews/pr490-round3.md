# PR #490 review (Opus, round 3)

Target: fix/steps-numbered-wrap @ fe8524953c503c8bb9d0d95c0c534acb8be2a6e4

## Conclusion
Round-2 M1 is resolved. A `steps()` row with any icon box now keeps every badge beside its title (one row-level guard in `layoutRow`), so no row mixes badge positions. Icon rows render byte-identical to main, and plain `box({step})` and the user's case are unchanged from round 2. converged: yes.

## Previous round
- M1 (rows where only some items have an icon mix badge positions): resolved. I reran the round-2 partial-icon sweep (4 title sets × widths 620–940 step 40 × icon on each item = 162 rows): 0 mixed (round 2: 48). Removing the new row guard fails test 5 and the new test 6 (2 of 8 fail). The per-box icon guards are gone from `badgeAbove` and the `map`, so the guard has a single place.

## Findings
### n1 (nit): stray space in `!(child as {stepRow?: boolean}).stepRow )`
- Evidence: lib/layout-row.ts, the `placedChildren` map, left over from removing the icon guard.
- Fix: drop the space.

## Other checks (no finding)
- Icon rows are unchanged from main. The same 162 partial-icon rows give SVG sha1 values identical to main at 8a3a246c (162/162). This means icon rows keep main's 1-character breaks (for example `見/積/作/成/手/順/書` at 620px). This is the documented trade-off in the commit, not a regression.
- Plain `box({step})`: the 270-case DSL sweep (row with connects, arrows, group, grid, tag, standalone; JA/mixed/EN; widths 360–960; left/centre/right) is byte-identical to main (270/270).
- User's case: the 408-render sweep (12 title sets × 620–940 step 20 × with/without body) gives the same result as round 2: 0 mixed, 0 `verdict.problems`, 32 one-character pieces, all `運用引継/ぎ` at 620–680px, the same as with `numbered: false`.
- `steps` inside `group()` without icons still moves all badges above at 620–760px and keeps them all beside at 860px. The internal `stepRow`/`stepAbove` flags do not reach the SVG.
- No other open PR touches `lib/layout-row.ts`, `lib/steps.ts`, `lib/layout-text.ts`, `lib/layout-box-like.ts` or `lib/box-step-geometry.ts`.
- CI on fe852495 (run 45807938693) is all green: golden, test (1/3), (2/3), (3/3).

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 0 / nit 1)
