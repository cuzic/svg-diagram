# PR #479 review (Opus, round 2)

Target: feat/slide-figure-warnings @ d1b715d42ddbc0be48b704b09ea58227c0fbf391

## Conclusion
All three round-1 Majors are fixed, and I checked each fix by behaviour and by mutation. The schema is regenerated. `doc-width` is now dropped only for `slide` + `fill`, which is right because `prepareBands` replaces the width with `slide.contentWidth` in that case. The `solid` / `solid-danger` dash is no longer counted as an outline. The author's stricter m1 rule (a shared label on two or more lines, with no exemption for a single line) is the better choice: my suggested "used by exactly one line" exemption would have silenced my own `5日` / `2日` counterexample. Two small leftovers stay (a nit and a Minor). CI is green on d1b715d4 (test 1/3, 2/3, 3/3 and golden). The branch merges with the current origin/main without conflicts (`git merge-tree`). converged: yes.

## Previous round
- M1: resolved. `node --test test/schema-files.test.ts` gives 12 pass, 0 fail, and CI `test (1/3)` now passes.
- M2: resolved. I probed with `checkDiagram`: `slide` only at `width` 1200 or 3000 reports `doc-width`, and `slide` + `fill` does not. With a budget, `lib/core.ts:126` sets the layout width to `slide.contentWidth`, so the user's `width` is not what gets drawn. Without a budget, `UNMEASURED_FILL_NOTE` is emitted (`lib/legacy-core.ts:320`), so the user is still told something. Reverting to `!d.slide` fails the new control test.
- M3: resolved. `solid` + `dashed` next to `solid-danger` fires again, in both directions. A `tones: {solid: {stroke: '#000000'}}` override makes the dash visible and correctly silences the rule. `accent` + `dashed` next to `new` (same fill) stays silent as before. Forcing `visible = true` fails the new control test.
- m1: resolved, with a justified deviation. The code exempts a style only when it has two or more lines, all labelled, with one shared label. Removing `e.n > 1`, `labels.size === 1` or `!e.bare` each fails a test. A shared label plus one bare dotted line still fires for dotted. Value labels that repeat by chance (two dashed lines both `1日`) are still silenced, but the ADR 0029 addendum documents that limit and the rule cannot tell such labels apart from naming labels. Accepted.
- m2: resolved. README, `RULE_DOCS['doc-width']`, `workflow.md` and the ADR 0010 addendum now say that `check` / `build` of the file alone still report it.
- n1: resolved. The addenda moved to ADR 0010 (`doc-width`) and ADR 0029 (gray / legend). ADR 0037 no longer carries them.

## Findings
### m1 (Minor): a whitespace-only label counts as a shared naming label
- Evidence: two dashed connectors, both `label: ' '`, with no legend: no `legend-missing` (probe through `checkDiagram`). `lib/legend-notation.ts:73` tests `b.label` for truthiness and does not trim. The same holds for any repeated filler such as `'-'`. This is narrow, because a user who writes a blank label is unlikely to want it read as words.
- Fix: count `b.label?.trim()` (a blank label sets `bare`).

### n1 (nit): the docs say `solid` / `solid-danger` are excluded, but the code tests whether the stroke equals the fill
- Evidence: `workflow.md` says 「`solid` / `solid-danger` は除く」. `lib/verify-gray-tones.ts:33` compares the resolved stroke with the fill, so a `tones` override that gives `solid` its own stroke makes the dash count, and one that sets another tone's stroke to its fill stops it counting. The behaviour is better than the docs. The header comment of `test/slide-figure-warnings.test.ts` also still says "doc-width (not for a slide figure)".
- Fix: say 「輪郭が塗りと同じ色のトーン(既定では `solid` / `solid-danger`)は除く」, and update the test header to "slide + fill".

## Checked and fine
- Mutations on all four new conditions fail `test/slide-figure-warnings.test.ts` (18 tests, all passing at head).
- The `byStyle` deletion cannot drop a style that another source adds. The only other `lines.add` (bpmn flows) runs only with `withCause`, and `itemWords` runs with `withCause = false`.
- `tsc --noEmit` is clean.
- No other open PR touches `legend-notation.ts`, `verify-gray-tones.ts`, `document-findings.ts`, `rules.ts` or `schema/config.schema.json`.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 1)
