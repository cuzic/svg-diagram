# PR #419 review (Opus, round 1)

Target: feat/source-locations-u3b @ 6cf1caa4c71fd1298b2f9309be15ed4a586a10dc

## Conclusion

The mechanics are sound: with capture off, `lintDiagram` output is byte-identical to main (text, severity, order, `data`) on all 191 examples and on the 38 rule fixtures in five variants (plain, `appearance: 'auto'`, `'dark'`, `accept` of every other rule, auto+accept; 500 findings). With capture on, every finding from examples and fixtures carries a location, inner boxes of `row` / `areas` are located correctly, `accept` keeps the location, the auto-appearance merge keys on location, and the JSON / github / sarif / text output and baseline fingerprints match the U3a shape. The VS Code extension (`src/check.ts`) reads only `line`, so it keeps working. Lint time with capture on is the same as main within noise (20 lint passes over all examples: 785–978 ms on the branch, 729–843 ms on main).

One real problem: the `a11y-text-contrast` dedupe changed from "once per colour pair" to "once per colour pair per part". `check` always captures, so `check` now reports new warnings on correct, unchanged input, and a baseline written on main no longer covers them (`--strict --baseline` goes from exit 0 to exit 1). The coverage test is also looser than its name says: it accepts *any* marked part, so the "nearest part" requirement and the `RULE_LOCATION` classification itself are not pinned.

## Previous round

None.

## Findings

### M1 (Major): `a11y-text-contrast` reports more warnings under `check`, so existing baselines break

`lib/rules.ts` `textContrast` (around L429–440). On main, `seen` holds `fg|bg` and the rule warns once per colour pair for the whole figure. The branch keys `seen` by `sourceOf(band)` first, so with capture on it warns once per part. The message names that part's text (`「二つ目」 の文字 …`), so each extra warning has a new message and a new baseline fingerprint.

Repro: three boxes in a row with `tones: {accent: {fill: '#808080', stroke: '#808080'}}`, `medium: 'doc'`.
- main `check`: 3 warnings (1 × a11y-text-contrast).
- branch `check`: 6 warnings (3 × a11y-text-contrast, for 「一つ目」「二つ目」「三つ目」).
- `main check --write-baseline base.json`, then `branch check --strict --baseline base.json`: main exits 0, the branch exits 1 with 2 "new" warnings.

This breaks three things:
- Issue #418 does not allow it: "規則の判定そのもの(何を指摘するか)は変えない" and "`--baseline` の指紋は変えない" (the fingerprints are unchanged, but the set of findings is not).
- ADR 0072 D4 names only `headlineLength`'s `seen` and `mergeSides` as dedupes that should take the location into their key. The colour-pair key is not a text-keyed dedupe. Its messages already differ between parts, and it was deliberately one finding per pair.
- `check` now disagrees with `build` / `show` / MCP, which run without capture and still report one finding.

The PR body says nothing about the change, and no test covers it.

Fix: keep one finding per `fg|bg` and attach the parts instead. Put the first part in `loc` and the others in `related`, as `a11y-nontext-contrast` does. Add a test with capture on: two boxes with the same failing pair give one finding with `loc` + `related`, and the `check --format json` count matches main.

### m1 (Minor): the coverage test accepts any marked part, so "nearest part" is not tested

`test/rule-locations.test.ts`: for a `'band'` rule the only check is `f.loc && parts.has(f.loc)`, where `parts` holds every marked object in the bands, the layout and the connects. A finding that points at the enclosing `row` / `grid` / `group` instead of the inner box still passes. Two hand mutations survived both `test/rule-locations.test.ts` and `test/check-layout-locations.test.ts` (0 failures each):
- In `lib/layout-metrics.ts` `framesOf`, the row children's `Frame.band` was set to the row. `layout-sibling-size` / `gutter-uneven` / `edge-misalign` / `unused-space` / `align-mixed` then point at the row.
- In `textContrast`, `at()` was given the row instead of the row child.

The only test that pins an inner box is `box-size-ignored` (column 10 rather than 5), and that rule walks `walkBands`, not the row-children code paths that U3b added. Fix: in the fixtures, record the expected part (for example, compare against `sourceOf(theBox)` for a few row/grid/areas cases), or add a CLI test like the `cjk-line-long` one for a layout-metrics rule and for `a11y-text-contrast` inside a `row`.

### m2 (Minor): flipping a rule's class in `RULE_LOCATION` is not caught

`lintDiagram` stamps the `diagram()` location onto every finding whose rule is `'diagram'`, overriding any part location. The coverage test reads the expected kind from `RULE_LOCATION` itself. Changing `'stat-no-source'`, `'layout-sibling-size'` or `'a11y-text-contrast'` from `'band'` to `'diagram'` passes every test, and their part locations silently become the `diagram()` line. Fix: pin the classification in the test, for example with a frozen expected list of the 29 `'diagram'` ids, or by asserting for `'diagram'` rules that the producer itself pushed no part `loc`.

### m3 (Minor): a `'band'` finding without a marked part gets no location instead of falling back to `diagram()`

Issue #418 scope 2: "1 つの規則で両方あり得るなら `'band'` にして、部品が無い指摘だけ `diagram()` にする". `lintDiagram` adds the `diagram()` location only when `RULE_LOCATION[rule] === 'diagram'`. A `'band'` finding whose part has no `SOURCE` ends up with no location at all: `at()` and `fromSources()` return `{}`. This happens for a hand-built object literal part, for `edge-crossings` when no connect is marked, and for `term-*` when only unmarked text matches. I found no such case in the examples (all findings were located with capture on), so it is a spec gap rather than an observed regression. Fix: in the same `out.map`, use `f.loc ? f : {...f, ...diagramLocation}` for `'band'` rules too.

### n1 (nit): two rules classified `'diagram'` really name parts

`graph-disconnected` lists the node ids of each cluster, and `legend-incomplete` is about an existing `legend()` part (when the legend is not `'auto'`). Both could be `'band'`: the smaller cluster's boxes, or the legend part, with `diagram()` as the fallback from m3. This is acceptable as is; note it in the table comment if you keep it.

### n2 (nit): `related` can list every box of a tone

`a11y-nontext-contrast` and `gray-tone-collision` put every box that uses the offending tone into `loc` + `related`. On a large figure that is dozens of SARIF `relatedLocations` for one finding. Consider capping the list, as the messages already do with `ほか N 件`.

## Checks run

- `gh pr checks 419`: golden and test 1/3, 2/3 and 3/3 all pass.
- Capture off, main vs branch: all examples and all fixtures × 5 variants are identical.
- Capture on: no finding without a location, and texts identical to capture-off on examples and fixtures. The exception is M1, which the fixtures do not trigger.
- Mutations:

  | Mutation | Result |
  | --- | --- |
  | `stat-no-source` `at(b)`→`at(d)` | caught (2 failures) |
  | per-part key removed from `cjk` `seen` | caught |
  | `related` dropped in `at()` | caught |
  | table flip ×3 | survived (m2) |
  | row-children→row in layout-metrics | survived (m1) |
  | row-children→row in textContrast | survived (m1) |

- `gh pr list`: no other open PR touches the files this PR changes.

## Verdict

converged: no (Blocker 0 / Major 1 / Minor 3 / nit 2)
