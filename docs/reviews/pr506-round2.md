# PR #506 review (Opus, round 2)

Target: feat/forest-u1 @ fd30a168b424790603a91c4e02fe0427de372c5e

## Conclusion
All four Majors from round 1 are resolved, and I checked each by its behaviour. A clipped summary is now a flat-cut diamond, and the PPTX has the same hexagon. With no `domain`, the axis goes one tick past `ref`. The clipping mutations now fail. The two rules are in the catalog, so `--rules`, `--explain` and `accept` work.
No new Blocker or Major. Two Minors remain, both narrow edge cases where the output stays safe, plus three nits. CI is fully green on fd30a168, and the PR is mergeable with no drift from main.
converged: yes.

## Previous round
- M1 resolved. With `low 0.3, high 9, summary`, `domain [0.5, 4]`, the path has 6 corners, with flat edges at plotL and plotR. The PPTX `custGeom` for it is the same hexagon (6 points, `x=0` and `x=w` with a non-zero height), and there is no `ppt/media`. Edge cases: low 0.499 gives a cut of height ≈0, which is correct, because the full diamond is nearly a point there. An estimate exactly at the axis end gives a full-height flat edge. The info message names the shape. ADR D6 is amended.
- M2 resolved. Without `domain` the extension behaves like this:
  - log 2^k: 1.02–1.3 gives `[0.5, 1, 2]`, and 0.6–0.9 gives `[0.5, 1, 2]`.
  - log 1-2-5: 1.02–40 gives `[0.5 … 50]`, and 0.02–1 gives `[0.02 … 2]`.
  - linear ref 0: 1–3 gives `[-0.5 … 3]`, and -3 to -1 gives `[-3 … 0.5]`.
  - When `ref` is inside the data, nothing changes (crossing data gives `[-2 … 3]`).
  - A written `domain` is never extended.
  The round-1 repro (all lows ≥ 1, with `favours`) now passes, and so does the `values: false` mirror case. The `favours` error names `domain`, and that fix works (see m1). ADR D3 and D7 are amended.
  The 16× boundary test still tests the boundary. The split is decided on the data and `ref` before the extension (0.0625–1 stays 2^k, 0.06–1 goes to 1-2-5). Mutating `16.0001` to 15.9 fails 1 test, and to 16.9 fails 1 test. Mutating the log extension (`Math.min(kLo, -1)` to `Math.min(kLo, 0)`) fails 2, `open = false` fails 2, and `open = true` fails 2.
- M3 resolved. The 4 round-1 mutations fail 2, 2, 1 and 1 tests: no clamp, `cutL = false`, the summary left out of `clipped`, and the diamond point at the estimate. So do `hl = 0` (the kite again) and `hr = 0`, with 1 each.
- M4 resolved. `lib/forest-rules.ts` follows the pattern of `table-rules.ts` and `state-matrix-rules.ts`: a `/* @__PURE__ */ Object.freeze({…} as const)` table with `doc` and `scope`. It is wired into `RULE_DOCS` and `RULE_LOCATION` and covered by `test/rule-locations.test.ts` and its fixture. `schema/config.schema.json` has both entries.
  - `check --rules` lists both, and `--explain forest-clipped` and `--explain forest-weight-partial` print the doc and the accept forms.
  - `check --verbose --format json` emits both as info, located at the `forest(` call.
  - `diagram({accept: {...}})` appends "（許容: …）" to both, and it type-checks. A misspelt key fails `tsc`.
  - The messages are in Japanese.
- m1 resolved (ADR D1 sets linear default ref = 0, and D3 documents the widened domain).
- m2: deferred to U2, as round 1 allowed. It is still open for U2 (see n3 below).
- m3 resolved (`values: false` with `valueHeader` is an error, and removing the check fails 1 test).
- m4 partly resolved: data below 1e-6 is an error, and removing that check fails 1 test. A `domain` or `ref` below 1e-6 can still produce "0" ticks, see m2 below.
- m5 resolved:
  - The right-side `favours` mutation fails 1 test, and the 12px indent mutation fails 1.
  - Removing `visit(b.children)` in `lib/bands/forest.ts` still survives, but the mutation is equivalent. `LaidOutRow` and `LaidOutGrid` hold only `LaidOutBox` children, and a `row([forest])` lays out flat as `group,chart`. The new nested test does catch a missing report.
- n1 resolved (ticks print "−5", and no text matches `/^-\d/`, verified by mutation). n2 resolved (one negative row puts `, ` in every row, verified by mutation). n3 left, as stated.

## Verified (no finding)
- CI on fd30a168 (run 46020353878, head SHA confirmed): test 1/3, 2/3 and 3/3, golden and ooxml-xsd all pass. Shard 1 includes typecheck, lint, `bundle-size`, `pnpm build && check-package-bundles.ts` and `check --strict examples/*.ts`.
- Local run, 12 files (forest, rule-locations, rules, schema-files, selective-bands, side-effects, pure-exports, public-exports, dsl-exports, chart-axis, spec, layout-budget): 305/306 pass. The one failure is `layout-budget` on `canvas-seven-s` ("improved: lower the budget"). That example has no forest, the round-2 commit only touches forest code and the rule catalog, and the test passes in CI, so the failure comes from the local fonts.
- Non-forest charts: the round-2 commit changes only `lib/charts-forest.ts`, `lib/forest-rules.ts`, `lib/rules.ts`, the schema, ADR 0084 and tests. `forestScale` has no caller outside `charts-forest.ts`, and `niceScale` is unchanged. The golden job passes byte for byte.
- Selective bundles: `forest-rules.js` is a pure data table like the other rule tables, and `check-package-bundles.ts` passes. No selective bundle contains forest yet (U2).
- D1–D9 regressions: the round-1 tests are kept, except one assertion that was replaced (`domain: [2, 4], ref: 1` with estimate 1.5, now covered by the `ref 1 is outside the axis` case). Single point, 10-row strict check, wrap, weights, the dotted line for one summary and the placement test all still pass.
- No other open PR touches the same files. `gh pr view 506`: MERGEABLE / CLEAN, 0 commits behind main.

## Findings

### m1 (Minor): when `ref` is not a tick but sits just inside the axis end, the axis is not extended, and `favours` still fails
- Evidence: `forest([{label:'a', estimate:50, low:5, high:95}], {scale:'linear', ref:5, favours:[…]})` gives `niceScale(5, 95)` = `[0 … 100]`. `ref` is not an end tick, so there is no extension, and the left note does not fit in the 5% of the plot (`lib/charts-forest.ts:96-97` only checks `near(n.min, s.ref)`). The same holds on a log 1-2-5 axis with a `ref` that is not a 1-2-5 value and wider labels (ref 1.5, data 1.5–60). The error names `domain`, and `domain: [-20, 100]` (or `[0.5, 50]` on the log axis) fixes it, so the output is safe. This only happens with a non-default `ref`.
- Fix: extend when the gap between `ref` and the axis end is under one tick step (or under the width of the note), not only when it is exactly zero. Otherwise, leave it as is.

### m2 (Minor): a log `domain` or `ref` below 1e-6 still prints "0" ticks (remainder of round-1 m4)
- Evidence:
  - `forest([{… low:0.5, high:2}], {domain:[1e-8, 4]})` draws the ticks "0", "0", "0.000001", …
  - `{ref: 1e-6}` with data 1e-6–3e-6 is allowed (data ≥ 1e-6). The extension then adds a 5e-7 tick that prints "0", and with `decimals: 3` the row prints `0.000 (0.000–0.000)`.
  - `check --strict` reports nothing.
  - The new check (`lib/charts-forest.ts:61`) covers only `low`.
- Fix: apply the same 1e-6 floor to `domain[0]` and to the lowest tick (or to `ref`), or format log ticks with `toPrecision`.

### n1 (nit): the minus-sign test has a precedence slip
`test/forest.test.ts`: `a.includes('1.0 (−1.0, 3.0)') && a.includes('−5') || a.includes('−4')` parses as `(… && …) || …`. The next line (`!/^-\d/`) still catches the mutation, so the test works. Add parentheses.

### n2 (nit): style of the Japanese messages and the ADR wording
- The new messages use ASCII parentheses inside Japanese text ("(矢じりで切る)", "(全部の行に…)"). Other rule messages use full-width "（…）".
- ADR D3 says the log extension is `ref / 2` and `ref × 2`. On the 1-2-5 path it is the next 1-2-5 value (data 0.02–2 with ref 2 extends to 5, not 4). The two are the same only for ref 1.

### n3 (nit): reminder for U2
When the forest selective entry is added to `check-package-bundles.ts` (round-1 m2), add `...(!bands.includes('forest.js') ? ['forest-rules.js'] : [])` to the exclusion list, as for `fta-rules.js` and `table-rules.js`.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 2 / nit 3)
