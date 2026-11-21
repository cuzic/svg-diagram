# PR #419 review (Opus, round 2)

Target: feat/source-locations-u3b @ 496ac73aa0db5d6405faebb86bc3171c48353287

## Conclusion

All six round-1 findings are fixed, and I re-checked each one by behaviour. The (a)/(b) split holds. With capture on, I compared main and the branch on every rule fixture in four variants: plain, a "double" variant (every band cloned, with fresh `SourceRef`s), `appearance: 'auto'`, and double+auto. Only `cjk-line-long` produced extra findings. It is a per-part (a) rule, so the task spec allows this. No `band-grouped` rule and no `band` rule changed its count or wording. A baseline written on main over all examples plus four warning-heavy figures passes `check --strict --baseline` on the branch. With capture off, `lintDiagram` gives the same findings as main: same rule, severity, message, `data` and order. That holds on all examples (plain, auto, dark) and on all fixtures. The only difference is key order (n1).

One gap remains. The connector branch of `a11y-nontext-contrast` lists arrows whose colour the message does not name, and neither its message choice nor its location is pinned by a test.

## Previous round

- M1 (Major, `a11y-text-contrast` per part): fixed. The round-1 repro (three grey `accent` boxes) gives 1 finding with `loc` = first box and `related` = the other two. The committed main baseline passes. Re-applying the per-part key is caught.
- m1 (Minor, nearest part untested): fixed. The `row` / `grid` / `areas` cases compare against the inner box. Both round-1 mutations are now caught: row children → row in `layout-metrics` (2 failures) and in `textContrast` (5 failures).
- m2 (Minor, class flip uncaught): fixed. `EXPECTED_SCOPE` is a literal table. Flipping `cjk-line-long` to `band-grouped` gives 2 failures, and flipping `stat-no-source` to `diagram` gives 3.
- m3 (Minor, no `diagram()` fallback): fixed. The fallback covers `!f.loc` and has a test, and removing it is caught.
- n1 (nit, `graph-disconnected` / `legend-incomplete`): fixed. Both point at parts: the components outside the largest one, and the parts using notation missing from the legend. Both are tested, and the mutations are caught.
- n2 (nit, unbounded `related`): fixed. `fromSources` caps `related` at 10. The JSON and SARIF test catches removing the cap. `at(first, ...rest)` goes through the same cap, so `layout-*` is capped too (checked: 13-box row → 10 related).

## Findings

### m1 (Minor): the connector branch of `a11y-nontext-contrast` relates arrows of other colours, and is untested

`lib/rules.ts` `nonTextContrast`, around L505–517. The message keeps main's wording: the colour of the first failing connector. `arrowRefs`, however, collects every failing connector, whatever its colour. Repro: three connects with `tones: {muted: {ink: '#c8c8c8'}, danger: {ink: '#d0d0d0'}}` (muted, danger, muted). The finding says `矢印の色 #c8c8c8 …`, and `related` includes the `danger` arrow, which is `#d0d0d0`. For a grouped rule, the related parts should be the ones the message describes (here, the arrows of that colour). The other option is to document that the related list holds every failing arrow.

No test covers this branch. Two hand mutations pass all of `test/rule-locations.test.ts`, `test/check-layout-locations.test.ts` and `test/rules.test.ts` (0 failures):
- `firstArrow ??= {col, r}` → `firstArrow = {col, r}`. The message then names the last failing arrow, which changes the wording from main with or without capture.
- Removing `arrowRefs.push(ref)`. The finding then falls back to `diagram()`.

Fix: filter `arrowRefs` to connectors with `col === firstArrow.col`. Add a capture-on test with two failing arrows of different colours. It should check the message names the first arrow's colour, `loc` is that arrow, and `related` holds only the same-coloured arrows.

### n1 (nit): `layout-*` findings from `lintDiagram` change key order even with capture off

`lib/rules.ts` `layoutQualityRules`: `out.push({...m, severity})`. On main this was `{rule, severity, message, data}`. Now `severity` comes last. The values are equal, but `JSON.stringify(lintDiagram(d))` differs from main for `layout-sibling-size`, `layout-unused-space`, `layout-figure-offset` and `layout-figure-narrow`. I counted 45 example×appearance entries. The CLI (`check --format json`) and `lib/spec.ts` rebuild the objects, so neither output changes. Only library callers that serialize findings see this. It was already present in round 1. Fix if cheap: `{rule: m.rule, severity, message: m.message, data: m.data, ...(m.loc ? {loc: m.loc} : {}), ...(m.related ? {related: m.related} : {})}`.

## Checks run

- `gh pr checks 419`: golden and test 1/3, 2/3, 3/3 all pass on 496ac73. Locally, `pnpm typecheck` and `pnpm lint` pass, and so do `test/rule-locations.test.ts` and `test/check-layout-locations.test.ts` (83 tests).
- CLI `check --format json`, main vs branch: on all 191 examples, 66 findings each, with identical (file, rule, severity, message) and every finding located on the branch. On four warning-heavy probe figures, grouped rules give the same counts as main. These cover contrast pairs across a `row` and a 14-box `grid`, `term-*`, `box-size-ignored`, `stat-no-source` ×2, `graph-*`, `legend-incomplete` with 13 parts, and `chart-axis-mismatch` ×3. The one difference is `cjk-line-long` ×2 for two identical headlines, an (a) rule, as designed.
- Baseline: `main check --write-baseline` over examples + probes (17 warnings), then `branch check --strict --baseline`: exit 0. Matching is set-based on file|rule|message, so the duplicate (a) findings above do not break it.
- `lintDiagram` with capture on, main vs branch: fixtures × {plain, double, auto, double+auto} (152 runs; 8 runs where the doubled ids collide fail the same way on both sides). The only count change is `cjk-line-long` in the double variants. Every finding carries `loc`.
- Capture off: fixtures × 4 variants and examples × {plain, auto, dark} give identical findings, apart from the n1 key order.
- `related` cap: JSON and SARIF give 10 for `legend-incomplete` (13 boxes + lines) and for `layout-sibling-size` (13-box row).
- Mutations:

  | Mutation | Result |
  | --- | --- |
  | row children → row (`layout-metrics`) | caught (2) |
  | row children → row (`textContrast`) | caught (5) |
  | `cjk-line-long` → `band-grouped` | caught (2) |
  | `stat-no-source` → `diagram` | caught (3) |
  | remove the 11-source cap | caught (1) |
  | remove the `!f.loc` fallback | caught (1) |
  | `mergeFindingSides` keys grouped rules by location | caught (1) |
  | `graph-disconnected` points at the largest component | caught (1) |
  | `a11y-text-contrast` per part again | caught (1) |
  | `legend-incomplete` without location | caught (3) |
  | arrow message from the last failing connector | survived (m1) |
  | arrow refs dropped | survived (m1) |

- `gh pr list`: #423 (U4a) conflicts with this PR in `check-diagram.ts`. Both rewrite the layout-issue block: `issueLocation` / `textLocation` here, `layoutFinding` there. Both #423 and #422 (U4b) conflict on the ADR 0072 status line. Whichever PR merges second needs a hand merge.

## Verdict

converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 1)
