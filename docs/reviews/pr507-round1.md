# PR #507 review (Opus, round 1)

Target: feat/forest-u2 @ be2165d7581b66c09c55e98d3df1809c2ebdd6d1 (f427451c on top adds only `examples/out/pptx-golden.json`)

## Conclusion
The spec part, the schema, the selective entries and the deck path all work. The spec draws the same SVG as the DSL. The deck example goes through `renderDeck` (serve), both edge writers and the `pptx-deck` CLI with the same warnings and the same `sz`. The bundle budgets hold.
Two Majors remain:
- The round-2 m2 fix uses a fixed threshold (0.0005), but ADR D4, as amended in this PR, ties the rule to `decimals`. At the default `decimals: 2`, a non-zero estimate still prints as `0.00`.
- The round-2 m1 fix (the reference line within one tick of an axis end) behaves correctly, but its tests do not pin it. Four of its six branch mutations survive, including removing the upper linear extension outright.

converged: no.

## Previous round (PR #506 round 2)
- m1: the behaviour is resolved, but it is not covered (see M2). Probes without `domain`:
  - linear, ref 5, data 5–95 gives `[-20 … 100]`.
  - linear, ref 95 gives `[0 … 120]`.
  - linear, data −3 to −1, ref 0 gives `[-3 … 0.5]`.
  - log 1-2-5, ref 1.5, data 1.5–60 gives `[0.5 … 100]`.
  - log, ref 40, data 1.02–39 gives `[1 … 100]`.
  - In every case `favours` now fits.
- m2: partly resolved.
  - A log `domain[0]`, `ref` or `low` below 1e-6 is an error. Removing the domain check or the low check fails 1 test each.
  - The extension can still put a tick below the floor (see m1 below).
  - The two-digit rule only works for `decimals: 3` (see M1).
- n1: resolved. The parentheses were added.
- n2: resolved. The messages use full-width "（…）", and ADR D3 now names the next 1-2-5 value.
- n3: resolved. `forest-rules.js` is excluded unless `forest.js` is in the bundle.

## Verified (no finding)
- **Spec part against the DSL.** Every DSL option except the chart-generic ones (`id`, `width`, `height`, `alt`, `labelRole`) is in the schema. Tornado and other chart parts leave those out too.
  - Limits match ADR D9: rows 1–40, label and heading 40, valueHeader 20, axisLabel 30, favours 2×20, decimals as an integer 0–3, scale as an enum.
  - `check()` covers the four combination rules and the all-heading rule. The paths are exact (`rows[i]`, `rows`).
  - Mutating each `check()` branch, and dropping the options in `build()`, fails 1 test each (6/6 killed).
  - `pnpm schema` regenerates `schema/spec.schema.json` byte for byte.
- **Deck path.** I ran `examples/forest-deck.json` and decks with 10, 13, 15, 20 and 40 rows, a figure in a column, a linear forest and a 3-column slide through `loadDeck` + `renderDeck`, `pptx-deck-edge`, `pptx-deck-selective-edge` (with `forestPart` and `svgShapes`) and the `pptx-deck` CLI.
  - No errors, and the warnings are identical on every path.
  - The `sz` sets are identical between full and selective, and there are no `<p:pic>`.
  - ADR 0085 interaction: the 14px warning fires on a 10-row forest in a narrow column ("~12.3px … cut items, or split the figure over two slides"). Forest is not in `FIXED_HEIGHT_PARTS`, so it gets the item advice, which is the right advice for a part made of stacked rows. 20 and 40 rows get the 9pt warning instead.
  - The example slide's text comes out at 15.25pt, so it does not warn.
- **Selective entries.** I bundled `spec/parts/forest` with `renderSpec` using esbuild with a metafile.
  - Its inputs hold only `spec-parts/forest`, `bands/forest`, `dsl/forest`, `charts-forest` and the shared chart core. There is no `r2.js`, `spec.js`, `dsl-pure.js`, other `charts-*` or `forest-rules.js`. The tornado catalog bundle has no forest module.
  - The `Forest` band case excludes the other chart modules, and `check-package-bundles.ts` passes (exit 0).
- **Budgets, measured.**
  - spec catalog forest: esbuild 79,975 / 88,000 and Vite 105,460 / 116,500. That is measured + 10 % rounded, slightly tighter than the rule on Vite. Reasonable.
  - range-bars Vite: 111,205 against the old 111,160 (over by 45). The new 111,300 leaves 95 bytes. Minimal.
  - `./browser`: 1,100,160 / 1,105,920 (`scripts/bundle-size.ts`). This PR does not change that budget.
- **README and skill.** The README export list, the chart table and the `forest` paragraph, the `rangeBars` cross-reference, `skills/svg-diagram/references/charts.md` and the `rangeBars` spec description all match the code (except n1).
- **Examples.** `check --strict examples/forest.ts` passes. The example is invented and labelled as invented ("作り話"), with generic site names. The `spec --part forest` CLI works, and `--part tornado` rejects the forest part with a clear message.
- **CI.** Both runs on be2165d7 are green. On f427451c, golden, ooxml-xsd and test 3/3 pass, and test 1/3 and 2/3 were still running when I wrote this.
- **Other PRs.** No other open PR touches these files.

## Findings

### M1 (Major): the "too small for its digits" rule ignores `decimals`, so the default `decimals: 2` still prints non-zero values as `0.00`
- Evidence:
  - ADR D4 (amended in this PR) says: "桁数で 0 になる小さな値（…）は、有効数字 2 桁で書く". `lib/charts-forest.ts:174` uses a fixed `Math.abs(v) < 5e-4`, which is only right for `decimals: 3`.
  - Probed through `checkDiagram`: `forest([{label:'A', estimate:0.004, low:0.001, high:0.007}, …], {scale:'linear', ref:0})` draws `0.00 (0.00–0.01)` with no problems and no findings.
  - A log OR of 0.01 (0.003–0.04) draws `0.01 (0.00–0.04)`.
  - Mixed in one cell: `forestValueText({decimals:2}, {estimate:0.0004999, low:0.0005, high:0.00049})` gives `0.00050 (0.00–0.00049)`.
  - With `decimals: 0`, 0.4 gives `0`.
  - The new test only checks `decimals: 3`.
- Fix: switch to two significant digits when `v !== 0 && Math.abs(v) < 0.5 * 10 ** -decimals`. Test it at decimals 0, 1, 2 and 3, including a cell whose three values fall on both sides of the threshold.

### M2 (Major): the ref-margin rule (round-2 m1) is not pinned by tests
- Evidence: I applied these mutations to `lib/charts-forest.ts` and ran `test/forest.test.ts` and `test/spec-r2.test.ts`:
  - linear lower back to the exact-end check: fails 1.
  - linear upper back to the exact-end check: **0**.
  - linear upper removed entirely (`if (false) ticks.push`): **0**. The −3 to −1 / ref 0 case from round 2 is not asserted anywhere.
  - linear lower `n.step * 0.5`: **0**, and `n.step * 2` (extends when ref is two ticks in): **0**.
  - log 1-2-5 lower back to `s.ref <= all[a]` (the pre-fix code): **0**. The new assertion `log[0] < 1.5 && log[0] <= 1` already holds without the fix, because the 1-2-5 axis for 1.5–60 starts at 1 anyway. With the fix it starts at 0.5.
  - log upper back to the pre-fix code: **0**, and log upper removed: fails 1.
  - log lower `all[a + 2]`: **0**.
- Fix: assert the exact tick arrays for each side:
  - linear: ref 5 and ref 95 on 5–95, and −3 to −1 with ref 0.
  - log: ref 1.5 on 1.5–60 must start at 0.5, and ref 40 on 1.02–39 must end at 100.
  - one "exactly one tick in, no extension" case per scale.

### m1 (Minor): ticks and values below the floor still print in exponent form (the rest of round-2 m2)
- Evidence:
  - `{ref: 1e-6}` with data 1e-6–3e-6 is allowed. The extension adds a 5e-7 tick, and it prints `5e−7`.
  - On a linear scale there is no floor. Data of 1e-8–3e-8 with ref 0 gives the ticks `−5e-9` (ASCII hyphen in the exponent: `.replace('-', MINUS)` replaces only the first) and `5e−9` (U+2212 in the exponent). The value column reads `2.0e−8 (1.0e−8–3.0e−8)`.
  - `check --strict` is clean in both cases.
  - Removing the `ref < 1e-6` check survives the tests, because the test's `low: 1e-7` fails first. Changing `tickText`'s `1e-3` branch to `1e-9` also survives.
- Fix: keep the extension tick at or above 1e-6 (or reject a ref whose extension falls below it). Give linear the same floor, or format without exponents. Test the ref floor with a valid `low`.

### m2 (Minor): spec errors raised in `build()` point at the wrong field
- Evidence (`validateSpec`):
  - `weight: 0` and a log `low: 0` or `1e-7` are reported at `parts[0].rows[0].label`, because `locateIn` matches the quoted label. They should be at `.weight` and `.low`.
  - A log `ref` below 1e-6, a `domain` below 1e-6 or reversed, `values: false` with `valueHeader`, and a duplicate row `id` are all reported at `parts[0]`.
  - The schema has `weight` at `minimum: 0` while its description says "above 0".
  - `bubble`'s `check()` uses `positive(…, \`${at}.points[${i}].size\`)` for the same kind of rule.
- Fix: in `check()`, report weight ≤ 0, a log low ≤ 0 or below 1e-6, a log ref or `domain[0]` below 1e-6, and `values: false` with `valueHeader`, each at its own field. The messages are already right.

### m3 (Minor): the deck example's headline contradicts its own data
- Evidence: `examples/forest-deck.json`'s slide title says "新方式は、10 拠点のうち 5 拠点で修了率を上げた", but the figure has 5 sites (A–E).
  - Of those 5, two intervals are above 1 (A, D) and four estimates are above 1.
  - In `examples/forest.ts` (10 sites), 7 estimates and 4 intervals are above 1. Neither file gives 5.
  - For an example meant to show how a forest slide reads, the claim should match the figure.
- Fix: make the title match the figure, for example "5 拠点のうち 2 拠点で、区間が 1 を上回った", or put all 10 sites in the deck figure.

### n1 (nit): stale README row
`README.md:347` still ends "（ADR 0084、spec の部品は U2）". This PR is U2, so say that the spec part is `type: 'forest'`.

### n2 (nit): the `./bands/forest` budget reuses tornado's and is loose
The measured sizes are esbuild 64,005 and Vite 85,953, against 97,000 and 118,500 (+52 % and +38 %). The sibling band cases are just as loose (Bubble 60,631 / 98,000, Butterfly 56,353 / 93,000, Tornado 61,230 / 97,000), so this follows the convention, and the exclude list does the real guarding. If you want the budget itself to catch a regression, measured + 10 % is 71,000 and 95,000.

## Verdict
converged: no (Blocker 0 / Major 2 / Minor 3 / nit 2)
