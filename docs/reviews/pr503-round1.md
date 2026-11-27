# PR #503 review (Opus, round 1)

Target: feat/deck-figure-text-size-u1 @ 56c33af0cc08531f53922d02b0c5b0687aa7f79b

## Conclusion
The behaviour matches ADR 0085 as accepted (Q1 14px fixed, Q2 warning, Q5 versus warns only, Q6 U1 first): the threshold is a fixed 14px on every figure slide, including slides with no lead; the 9pt message is byte-identical; the advice depends on the cause; and renderDeck (serve, site), the pptx-deck CLI, the full edge writer and the selective edge writer all give the same warnings and the same advice, including for columns, auto columns, `fit: 'width'`, JSON-path figures and `.ts` figures. Nothing is drawn differently, and the browser bundle is unchanged. The tests do not cover two paths that this PR adds code to: the pptx-deck CLI path and the column part types. Mutations to either still pass the tests. converged: no (2 Major, both tests only).

## Previous round
None (round 1).

## Findings

### M1 (Major): the pptx-deck CLI path is untested; dropping its part types, or the new warning itself, passes every test
- Evidence: `pptx-deck-diagram.ts:104` gets its own `figurePartTypes` argument, but no test runs the CLI with a small figure. Mutation m3 removes the `{figure: …, columns: …}` argument (the CLI then gives the general advice). Mutation m10 filters `figure text` warnings out of the CLI's `console.error` loop. Both SURVIVED against `deck-figure-text-size`, `deck-columns`, `pptx-deck`, `slide-figure-warnings` and `present-render-deck`. The behaviour is correct today: I ran the CLI on a probe deck, and its 7 warnings were identical to renderDeck's. ADR D1 assumes the CLI goes through `pptx-deck-edge-core`, but it calls `slideIssues` itself, so the edge test does not cover it.
- Fix: add a CLI test (spawn `pptx-deck-diagram.ts`, as `deck-figure-problems.test.ts` does) that checks the stderr has the `figure text is ~…px` line with the cause-specific advice, for one circle figure and one stacked-row figure.

### M2 (Major): column figures' part types are untested on all three paths
- Evidence: these mutations each SURVIVED. m1: `render-deck.ts` passes `undefined` in place of `s.columns?.[j]?.figure`. m2: `pptx-deck-edge-core.ts` passes `columns: []`. m4: `lib/pptx/deck.ts` `slideIssues` passes `parts: undefined` for a column. Each one turns the column advice into the general sentence without failing a test. The behaviour is correct today: a probe slide with `columns: [{figure: versus}, {figure: venn}]` gives "cut items…" on `columns[0]` and "give the figure more height…" on `columns[1]`, the same on renderDeck, full edge, selective edge and the CLI.
- Fix: add one columns case (two figure columns of different causes) to the renderDeck test and the edge test, checking each column's advice.

### m1 (Minor): a column figure is told to "put it in a column beside the text"
- Evidence: for the same probe, `slides[4].columns[1].figure` (a venn already in a column) gets "give the figure more height (fewer callouts, or put it in a column beside the text)". The ADR wording does not tell columns apart, so this follows the ADR, but the advice does not apply.
- Fix: when the warning is for a column, leave out "or put it in a column beside the text" (for example, pass a `column` flag to `smallTextWarning`).

### m2 (Minor): the README does not describe the actual behaviour
- Evidence: README line 78 says the 9pt warning "これまでどおり先に出る", which suggests both warnings appear. In fact a figure under 9pt gets only the 9pt message (`smallTextWarning` returns early). The README also leaves out the general advice for `.ts` figures, the mixed-part advice, and the note that MCP `render_deck` does not give this warning (ADR D2 says it is out of scope).
- Fix: say "instead of" for the 9pt case, and add the `.ts` and mixed advice and the MCP note in one clause each.

### n1 (nit): "the size it is drawn at before scaling" is not always true
- Evidence: a `.ts` figure that lowers its text floor (ADR 0017, `font-floor-lowered`) is drawn under 14px, so the parenthesis in the message is wrong for it.
- Fix: "(under 14px, the figure text size at scale 1)" or similar.

## Checks that passed
- Threshold: `MIN_FIGURE_TEXT_PX = 14`, a fixed value that does not depend on the lead. A slide with no lead or callout warns (test, plus a probe with only a source). Tolerance 0.02px. Mutation m7 (tolerance 0.3) killed.
- The 9pt message: it is byte-identical to main and takes precedence. The test asserts the exact string.
- Advice by cause: `FIXED_HEIGHT_PARTS` = concentric/venn/cycle. Removing cycle (m8) or concentric (m9) is killed. Removing the figure's own parts in renderDeck (m5) or in the edge writer (m6) is killed.
- `figurePartTypes`: JSON specs have no nested part containers, so reading only the top-level `parts` is complete. A JSON-path figure is inlined by `deck-file.ts`, so its types are read; a `.ts` figure gives [] and the general advice; `fit: 'width'` is checked the same way (probe).
- Entry points: on one probe deck, renderDeck, full edge (`pptx-deck-edge.ts`), selective edge (`pptx-deck-selective-edge.ts`, with `BAND_HANDLERS`) and the `pptx-deck` CLI (through `loadDeckSelective`) gave identical warnings. serve (`render-thread.ts`) and site (`site-diagram.ts`) print renderDeck's warnings. MCP `render_deck` is out of scope, as the ADR says.
- Ratchets: `band-type-literals` and `pure-exports` pass (`figurePartTypes` is tested, and the fixture is unchanged). Budget: `./browser` is 1,081,824 / 1,085,440, the same as main (`deck-layout.ts` is not in the browser bundle). CI is all green.
- Warning counts: the 46 spec-part `example`s, each on a slide with a title and lead, and again with a callout, gave 0 new warnings. Six local decks (223 figures, counts only) gave 16 new warnings and 0 at 9pt, against the ADR's 15 at T=14. The effective sizes were 12.2 to 13.9px. Advice: 10 stacked rows, 2 circles (cycle), 4 general (`.ts`). 6 of the 16 are at 13.8 to 13.9px (scale about 0.99). That is within Q1, but it is worth watching when U2 sets the baseline.
- Other open PRs: none touch the same code. (#374 and #444 change other parts of README files.)

## Verdict
converged: no (Blocker 0 / Major 2 / Minor 2 / nit 1)
