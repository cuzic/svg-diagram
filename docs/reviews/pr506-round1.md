# PR #506 review (Opus, round 1)

Target: feat/forest-u1 @ f64380d59bb382c9075a5217ffc748e2e5c8665d

## Conclusion
The core of ADR 0084 U1 is in place and mostly sound. D1–D7 behave as written for ordinary input. The PPTX output is shapes and editable text, and the slide XML passes pml.xsd. CI is fully green.
It does not converge yet, for four reasons. A summary diamond that runs past the axis is drawn as a kite that misstates its interval (the author's decision 2 is rejected). A common input, where every interval lies on one side of the reference, cannot take `favours`, and the error gives a fix that does not work. The clipping path has no test that a mutation breaks. The two new info rules are missing from the rule catalog.
converged: no.

## Previous round
None (round 1).

## Verified (no finding)
- CI on f64380d5: test 1/3, 2/3 and 3/3, golden and ooxml-xsd all pass. Run locally: `test/forest.test.ts` and the ratchets (band-type-literals, dsl-exports, layout-handlers, public-exports, pure-exports, side-effects, source-locations-builders, spec, package, selective-bands, chart-axis), 355 tests, 0 failures.
- D1 to D7 for ordinary input. Errors checked: empty rows, 41 rows, all headings, extra keys on a heading row, heading together with label, weight on a summary row, weight 0, -1, `'5'`, Infinity, NaN, duplicate ids, decimals 4, scale `'sqrt'`, ref 0 and a domain at or below 0 on a log scale. Also an estimate or the ref outside the axis.
- Log ticks: 0.25–4, 0.5–8 and 0.0625–1 give 2^k ticks; 0.06–1 gives 1-2-5. A single point (1, 1, 1) gives 0.5 1 2. The range 1e-6–1e6 has 37 ticks, thinned with `thinTicks`. 0.9–1.1 gives 0.5 1 2.
- Wrapping: a two-line label makes its row taller and its value stays centred on the row. An unbreakable Latin label overflowing at `width: 500` is reported by `verifyChart` as an overlap, so it is not drawn wrongly without a warning.
- Single row: height 160, no findings. 40 rows: height 1084, no problems.
- `check --strict` on a 10-row figure with headings, a wrapped label, `domain` clipping on both sides and a summary row passes; the clipping is reported only as an info.
- PPTX (D8): `pptx` of that figure and of a linear figure with negative values. No `ppt/media`, so no PNG. The numbers are `<a:t>` text ("1.54 (1.22–1.95)", "−4.2 (−7.9, −0.5)"). The diamond is a `custGeom` shape. Both `slide1.xml` files validate against the ECMA-376 transitional `pml.xsd` (the schema from `test/helpers/pptx/xsd.ts`, checked with lxml).
- Several forests at the top level, in a `row()` or in a `group()` each report their own `forest-clipped` info. Two forests in a row raise no `chart-axis-mismatch` (D3).
- Bundle: on main (08dafa41) `./browser` is 1,089,045 bytes, on this PR 1,098,404 (+9,359). The limit rises by 15,360 to 1,105,920, which leaves 7,516 bytes for U2; the owner decided this. ADR 0080 Q22 has its note and both tables updated. U2 should fit in the 7,516 bytes and not raise the limit again.
- Fixture and ratchet changes are additive and only add forest: public-exports (5 types and `forest`, twice), dsl-exports, source-locations-builders, layout-handlers and `IN_NO_SPEC_YET`. No golden changes.
- No overlapping open PRs (`gh pr list`).

## Author decisions (outside the ADR)
1. **`domain` widened to round ticks, with clipping and errors judged at the widened ends: accepted.** This matches tornado, and the axis still depends only on `domain`, `scale` and `ref`, so figures with the same `domain` still share one axis. The ADR must say so, though (m1).
2. **The summary row clipped without an arrowhead: rejected** (M1).

## Findings

### M1 (Major): a clipped summary diamond is drawn as a kite whose point sits on the axis end, so it reads as an interval that ends there
- Evidence: `forest([...,{label:'S', estimate:1.5, low:0.3, high:3.5, summary:true}], {domain:[0.5,4]})` gives `M48.7 65 L436.5 56 L735.5 65 L436.5 74 Z`. The left point is moved to the axis start (0.5) with no cut mark, and the right one sits at 3.5. In the rendered 10-row example (low 0.45, domain [0.5, 4]) the diamond becomes a long thin spike that reads as "0.5 to 1.49", while the column says 0.45. `lib/charts-forest.ts:185-188` clamps `xl`/`xh` through `xOf` and keeps the diamond shape. The info message (`:207`) still says "cut at the end with an arrowhead" for this row, which has none. ADR Q8 decided "cut at the end with a mark" for intervals that leave the domain; the summary interval is one of those intervals.
- Fix: draw a clipped summary as a truncated diamond, with a flat vertical edge at the axis end. The top and bottom edges stop at the heights that the full diamond would have there. Optionally add the arrowhead too. Make the info message match the mark, and record this in ADR D6.

### M2 (Major): when every interval lies on one side of `ref` (all lows ≥ 1, for example), the axis starts at `ref`, `favours` cannot fit, and the error gives "raise width" as the fix, which does not work
- Evidence: a three-row figure (two studies and a summary, all lows between 1.02 and 1.22) with `favours: ['control better', 'app better']` (invented wording, in Japanese in the run) throws `the note "← …" is wider than the room left of the reference line (shorten favours, or raise width)`.
  - The ticks are `ref × 2^k` from `floor(log2(min(ref, data)/ref)) = 0` (`lib/charts-forest.ts:89,93`), so `ref` is the first tick and `xr = plotL`.
  - The room on the left is then `labelW + 8` (`:148`). `labelW` depends on the label texts, not on `width`, so raising `width` changes nothing.
  - Even a short note fails with short labels (`favours: ['short', …]` with label 'A'). Without `favours`, the reference line is drawn on the plot's left edge, and the axis has only two ticks (1 and 2).
  - With `values: false` the same happens on the right side (room = 12px) when every interval is below 1.
  - This is the normal case for a meta-analysis where every study favours one arm. The ADR's spike data happened to cross 1.
- Fix: when `ref` would be an end tick (with no `domain`), extend the axis by one tick beyond `ref` on that side (log: `ref/2`; linear: one `niceScale` step), and amend ADR D3. In any case, the error must name a fix that works (`domain: [0.5, …]`).

### M3 (Major): the clipping path (Q8) has no test that a mutation breaks
- Evidence: hand mutations of `lib/charts-forest.ts`, each run against `test/forest.test.ts`:
  - `xOf` without the `[0,1]` clamp (`:143`), so the interval runs into the number column: 0 failures. Test (vi) checks only `problems == []` and the arrowhead count, and `verifyChart` does not catch the line past the axis.
  - `cutL = false` (`:182`), so there is no left arrowhead and no info for a left clip: 0 failures. Test (vi) clips only on the right.
  - The summary row left out of `clipped` (`:183`): 0 failures.
  - The diamond's left point moved to the estimate: 0 failures.
  For comparison, the mutations of the dotted line rule, the weight formula, the separator and the single-tick axis do fail.
- Fix: in test (vi), check the endpoints of the clipped line (equal to the plot's ends), clip one row on the left, and clip a summary row (shape per M1, and named in the info).

### M4 (Major): `forest-clipped` and `forest-weight-partial` are not in the rule catalog
- Evidence:
  - `node check-diagram.ts --explain forest-clipped` prints `ルール "forest-clipped" はない` ("there is no rule forest-clipped"). Meanwhile `check --format json` on the same figure emits `"rule": "forest-clipped"`.
  - The rules do not appear in `check --rules` or in `schema/config.schema.json`. `accept` is typed `Partial<Record<RuleId, string>>` (`lib/types/core.ts:120`), so `diagram({accept: {'forest-clipped': …}})` does not type-check.
  - Every other info rule the code emits is registered (checked 15: `arrow-labels`, `fta-single-point`, `ladder-height-bound` and others). ADR D7 names both rules.
  - The messages are also English (`lib/charts-forest.ts:171,207`), while the findings of other bands are Japanese (for example `bars-thin-bar`).
- Fix: add a `forestRules` table (doc and scope) the way `verify-bars.ts` and `lib/rules.ts` do, add the rows to `test/rule-locations.test.ts`, run `pnpm schema`, and write the two messages in Japanese.

### m1 (Minor): the ADR does not record decision 1 (widened `domain`) or the linear default `ref`
- Evidence:
  - With `domain: [0.5, 3]` an estimate of 3.5 is accepted, because the axis is widened to 0.5–4. ADR D3 says an estimate outside `domain` is an error.
  - `domain: [1.2, 3]` with `ref: 1.5` gives the axis 0.75–3.
  - `scale: 'linear'` without `ref` sets the reference to 0 (`:43`). ADR D1 says the default is 1.
  - Both behaviours are reasonable.
- Fix: amend ADR D1 and D3 (domain = "widened to the enclosing round ticks"; linear default ref = 0).

### m2 (Minor): there is no `./bands/forest` package export and no `check-package-bundles.ts` entry
- Evidence: `lib/bands/forest.ts` exists, but `package.json` has `./bands/tornado` and not `./bands/forest`. `scripts/check-package-bundles.ts` has a Tornado entry and budget but none for forest, and the checklist is `[ ]`. ADR U2 lists only the spec part.
- Fix: put the band export, the selective bundle entry and its budget explicitly in U2's scope (or add them here).

### m3 (Minor): `values: false` together with `valueHeader` draws a header over an empty column
- Evidence: `lib/charts-forest.ts:159` draws `valueHeader` whatever `values` is. With `{values: false, valueHeader: 'OR (95% CI)'}` the header sits at the top right over the plot area, and `check --strict` passes.
- Fix: make this combination an error in `resolveForest` (or ignore the header).

### m4 (Minor): log ticks below 1e-6 print as "0", and values below 0.0005 print as 0.000
- Evidence: `numText` (`lib/charts-base.ts:67`) falls back to `toFixed(6)` for exponent notation, so the 1e-7 tick prints "0" (and 5e-7 prints "0.000001"). The data 1e-12–1 makes such ticks. `decimals` ≤ 3 makes an estimate of 0.0004 print `0.000 (0.000–0.000)`. Such ranges are rare for ratios.
- Fix: format ticks with `toPrecision(3)` on a log axis, or reject data below 1e-6 with a message.

### m5 (Minor): test gaps (the behaviour is correct)
- Evidence: these mutations survive:
  - findings of a forest nested in `row`/`group` (`visit(b.children)` removed in `lib/bands/forest.ts`);
  - the right-side `favours` check (`:149`);
  - the 12px indent for headings (`:136`).
- Fix: add one assertion for each.

### n1 (nit): the linear axis ticks print "-5" (ASCII hyphen), while the number column prints "−4.2" (U+2212) in the same figure.

### n2 (nit): the number column mixes separators when only some rows are negative ("−4.2 (−7.9, −0.5)" above "12.3 (3.5–21.0)"). This follows D4 as written, but using ", " for the whole column once any row is negative would read more evenly.

### n3 (nit): a weight ≥ 1e15 is rejected as "must be a finite number (got 1e+15)" (the shared `finiteNum` limit). The message is misleading.

## Verdict
converged: no (Blocker 0 / Major 4 / Minor 5 / nit 3)
