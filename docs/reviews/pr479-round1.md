# PR #479 review (Opus, round 1)

Target: feat/slide-figure-warnings @ 5e3b867d7d7cc554caf9a9a4bf08ff4670ba820f

## Conclusion
The deck-path filter is sound (the deck has its own slide min-text warning, both `forSlide` call sites are covered by tests, and the fill search never widens past 940 so it cannot pick a different width). But the PR breaks CI (stale `schema/config.schema.json`), and two of the new exemptions silence real problems: `diagram({slide})` without `fill` now hides an arbitrarily wide figure with no replacement warning, and a per-box `dashed` on a stroke-less tone (`solid`, `solid-danger`) is counted as a visible outline although the dash is drawn in the fill colour. converged: no.

## Previous round
n/a (round 1)

## Findings
### M1 (Major): the PR's own change makes `test/schema-files.test.ts` fail; CI `test (1/3)` is red
- Evidence: the `legend-missing` text in `lib/rules.ts` changed, and `schema/config.schema.json` copies RULE_DOCS into the `accept` descriptions. `node --test test/schema-files.test.ts`: `schema/config.schema.json is stale` (diff only on the `legend-missing` description). It passes on main @3d48d63. The CI run 45762812948 job `test (1/3)` fails with that same message.
- Fix: run `pnpm schema` and commit `schema/config.schema.json`.

### M2 (Major): `diagram({slide})` without `fill` drops `doc-width` with nothing to replace it, so a very wide figure is now silent
- Evidence: `lib/document-findings.ts:14` (`!d.slide`). `diagram({theme: 'blue', width: 3000, slide: {page, heading}}).add(row([...]))`. `renderDiagram(..., {budget: 'cacheOnly'})` gives `verdict.warnings = []` and `fit.warnings = []` (scale 1, effectiveFont 15). The same figure without `slide` gets `[doc-width]`. A doc-medium figure gets no slide-fit or min-text check, so nothing says that its text will shrink to about a third when it is put in the slot. A `fill` figure is built to its slot, but a `slide`-only figure keeps its own `width`. (The deck path is fine: the same 3000px figure in a deck reports `scaled to 39% … smallest text is 4.4pt`.)
- Fix: exempt only `slide` + `fill`, or, when a `slide` budget is present, judge the width against the slot (its scale and the smallest text) instead of 940. Add a control test for `slide` without `fill`.

### M3 (Major): `gray-tone-collision` is silenced by `dashed: true` on a tone that has no visible outline (`solid` / `solid-danger`)
- Evidence: `lib/tokens.ts:121-122`: `solid` and `solid-danger` have `stroke: null`, so `resolveBoxStyle` uses the fill colour for the stroke. In the blue theme, `box({tone: 'solid', dashed: true})` next to `box({tone: 'solid-danger'})`: on main and without `dashed`, the rule fires. With `dashed: true` it does not, yet the SVG is `<rect … fill="#1d5fa8" stroke="#1d5fa8" … stroke-dasharray="6,4"/>`. The gaps show the same colour, so the edge looks solid in grayscale. `verify-gray-tones.ts` takes `marks.get(b)?.dashed` as an outline cue without checking that the outline differs from the fill. The tone-level `a.dashed !== b.dashed` test was safe only because no stroke-less tone is dashed by default.
- Fix: count a box's `dashed` as an outline only when the resolved stroke differs from the fill (or the tone has a stroke). Add the `solid` / `solid-danger` pair as a control test.

### m1 (Minor): a label that does not explain the line style still exempts it from `legend-missing`
- Evidence: `lib/legend-notation.ts:68`. Three connectors (solid `3日`, dashed `5日`, dotted `2日`) with no legend give no `legend-missing`. On main the rule fires for `line:dashed` / `line:dotted`. The labels give each edge a value, but nothing says what dashed or dotted means. The rule cannot tell an explanatory label (`非同期`) from a value label. That is a stated design choice (ADR 0037 addendum), so this is Minor, but the proxy is weak.
- Fix (suggested): exempt a style only when its lines share a single label (the label names the style), or when the style is used by exactly one line. Otherwise keep the entry.

### m2 (Minor): the docs say deck figures are not checked, but `check` / `build` of the same `.ts` still report `doc-width`
- Evidence: `node check-diagram.ts fig-3000.diagram.ts` (a figure that a deck uses) prints `[doc-width]`, while `renderDeck` of a deck naming it does not. `check` has no deck context (it refuses a deck.json), so the difference is expected. But README, `RULE_DOCS['doc-width']` and the ADR addendum say 「デッキのスライドの図は対象外／検査しない」 without qualification, and a user who runs `check --strict` over `fig/*.ts` keeps the original accept burden.
- Fix: word it as "not reported when a deck draws the figure; `check` / `build` of the file alone still report it (use `accept` or the project's `maxWidth` for a directory of slide figures)". Or, if the original report came from `check`, say so in the ADR: this PR does not cover that case.

### n1 (nit): the addendum sits in ADR 0037 (the readability of diagnostics), but it changes what three rules mean
- Fix: optional. Point to it from the ADRs that define the rules, or keep it as is and mention it in the README.

## Test failures (author's 9 vs clean main)
The full `node --test test/*.test.ts` on this branch gave 4019 tests with 9 failures. I ran the 7 affected files on main @3d48d63 (the merge base) and on the branch: main fails 8 and the branch fails 9. The 8 shared failures are environment-related (Chromium atoms ×2, the emoji glyph test, the emoji and Japanese system-font tests in raster ×2, the layout budget, the examples' lint --strict, rich's tspan lint). The **9th, `test/schema-files.test.ts` "schema/ holds exactly the files…", is caused by this PR** (M1). CI agrees: `test (1/3)` fails on it, while `test (2/3)`, `test (3/3)` and golden pass.

## Checked and fine
- Mutations: dropping `forSlide` on the spec branch fails a test, and so does dropping it on the `.ts` branch.
- A per-box `dashed` inside `row([...])` and under `appearance: 'auto'` is read correctly (nested bands are in `bands`).
- A tone that has both dashed and solid boxes still fires.
- `legend: 'auto'` is unchanged. A label of `''` does not exempt a line.
- The edge / MCP deck path (`pptx-deck-edge-core`) never surfaced per-figure findings, so nothing diverges there. Spec figures are 940 wide or narrower (ADR 0057), so MCP `render_diagram` / `check_diagram` are unaffected.
- No other open PR touches these files.

## Verdict
converged: no (Blocker 0 / Major 3 / Minor 2 / nit 1)
