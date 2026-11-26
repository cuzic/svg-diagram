# PR #483 review (Opus, round 1)

Target: fix/compare-row-header-and-cols @ 9162c89b8cd93101078ca709edaecff2b9bfa83b

## Conclusion
C1 does what it says. Measured with the real Node font backend, row headers in compare and in ruled harvey now end at least 8px before the first column rule at every width I tried (main: -1.0px, i.e. crossing the rule, for "Internationalization" and "Long Term Support Policy"). C2's messages are correct for compare(). But the tighter wrap limit (bold, `rowW - 16`) now rejects row names that main drew cleanly at narrow chart widths. That breaks existing figures, and no test or PR note covers it (M1). converged: no.

## Previous round
n/a (round 1)

## Findings
### M1 (Major): narrow figures that built on main now throw "the row name … is too long"
- Evidence: I ran `checkDiagram(diagram({width: 640}).add(compare([row, 'Cost'], ['A','B','C','D'], …)))` on main and on the PR head (real fonts). With `row = 'Telecommunications Infrastructure'`, main builds with 0 problems: the wrapped line "Telecommunications" sits 2.4px from the rule, so it does not touch it. The PR throws `compare(): the row name "Telecommunications Infrastructure" is too long for 128px (shorten it, or raise width)`. `'Internationalizations'` behaves the same way. Widths 720 and up and the default width still build. Cause: `lib/charts-rating-table.ts:38`. `rowW` is still capped at `g.w * 0.24` (ruled) / `0.38`. Line 42 now asks every line to fit `rowW - 16` in bold. So a single word whose bold width falls between cap−16 and cap−8 used to draw and now fails. The spec schema allows row text of up to 30 characters, so MCP specs reach this. In decks, a column figure at such a width falls back to the document width with a fallback warning, so its layout changes silently. Narrow figures with a fixed `height` can also now fail the height check, because names wrap to more lines.
- Fix: raise the floor of `rowW` to the widest bold atom among the row names plus 16, still within the existing `colW`/`noteW` "columns do not fit" guard, so that a word which fits is drawn instead of rejected. Add a test at chart width ≈ 600 for a long single word or two long words. If rejecting is intended instead, say so in the PR and the CHANGELOG and add a test that pins it.

### m1 (Minor): column headers keep the old tight padding, the same defect class as C1
- Evidence: line 41, `fit(k, colW - 8, colW - 4, …)`, still lets a centred bold column head come within about 2px of the rules on both sides. I swept with the real font: at `w=760`, 4 or 5 options, one long word, the gap is 1.6px on both main and the PR. This is not a regression, and only unusual long single words hit it.
- Fix: use `fit(k, colW - 16, colW - 16, …)` for the heads (a follow-up is fine).

### m2 (Minor): the C2 "swap rows and columns" advice is wrong whenever there are more than 6 rows
- Evidence: `lib/charts-compare.ts:24`. With 8 criteria × 7 options, the message tells the user to swap. The swapped table has 8 columns and fails the same check. The message also only reaches the DSL. MCP/spec users are stopped earlier by the schema (`lib/spec-parts/compare.ts`, `cols: list(…, 6, 1)`). They get the generic `has 7 items; the limit is 6` from `lib/spec-validation.ts:37`, with no hint on how to fix it.
- Fix: suggest the swap only when `rows.length <= 6`. Otherwise suggest only splitting. Optionally, mention the swap in the spec part's `cols` description, which is the text the MCP client sees.

### n1 (nit): message language
- `compare()` now mixes English messages ("needs at least one row") with the two new Japanese ones. harvey's limit message is still English. Both languages already appear in lib, so this is a choice to make on purpose, not a bug.

### Checked, no finding
- The corner is drawn regular and muted, and it is measured regular for `rowW` and for its fit. Its limit `rowW - 16` from inset 8 leaves 8px. In unruled harvey (inset 4) it leaves 12px, and there is no column rule there anyway.
- Wrapped row names grow `rowH` (line 46 uses `names[i].length`). Wrapped corner/heads grow `headH`. Nothing overflowed in the probes.
- The notes stay ≥ 8px from the next rule (`noteW = colW - ratingW - 16`).
- PPTX: main has no native table for rating tables. Open PR #372 (native PowerPoint tables) also edits `charts-rating-table.ts` and `charts-compare.ts`, but not lines 38/42/43 or the `resolveCompare` guard. Its cell boxes reuse `rowW`, so it inherits this fix. Expect a trivial merge.
- Targeted tests: `test/charts-compare.test.ts` (8/8), harvey and spec-r5 tests (21/21) pass locally. CI: golden passed (no golden change). The test shards were still running at review time.

## On the open question (verify rule for text touching rules)
Recommend: open an issue, not in this PR. C1 and m1 both passed `check`. The canvas already records `segs` and text boxes per chart, so a chart-level rule ("a text box intersects, or comes within N px of, a non-dashed segment of the same chart part") would catch this whole class for compare/harvey/heatmap/matrix without per-chart tests. It needs its own ADR-level decision on N, on exemptions (labels placed on lines on purpose, plated labels), and on whether it is a warning or a problem.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 1)
