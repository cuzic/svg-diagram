# PR #503 review (Opus, round 2)

Target: feat/deck-figure-text-size-u1 @ eb1264ff8632482239448ab7ea86ce32bb0db7da

## Conclusion
All round-1 findings are resolved, and each one was checked by its behaviour. The round-1 mutations on the CLI and column paths (m1, m2, m3, m4, m10) are now killed. The new `column` flag is set the same way on every entry point. renderDeck passes `true` for column figures. `slideIssues` passes `true` for columns and leaves it out for the slide figure, and the full edge writer, the selective edge writer and the `pptx-deck` CLI all reach it through that one call. Mutations to the flag are killed on each path. The changed code adds no new Blocker or Major. converged: yes.

## Previous round
- M1 resolved: new tests spawn `pptx-deck-diagram.ts` and check stderr. m3 (drop the part-types argument) fails 2 tests, m3b (`columns: []`) fails 1, m3c (`figure: []`) fails 1, and m10 (filter out `figure text` warnings in the CLI's stderr loop) fails 2.
- M2 resolved: the two-column case (versus | venn+table) now runs on renderDeck, the edge core, `slideIssues` and the CLI. m1 (renderDeck passes `undefined` for column parts) fails 1 test, m2 (edge core passes `columns: []`) fails 1, and m4 (`slideIssues` passes `parts: undefined`) fails 3.
- m1 resolved: `smallFigureAdvice(parts, column)` leaves out "or put it in a column beside the text" for column figures, and the whole-slide figure still gets it (asserted). Flag mutations are killed: renderDeck passes `false` for columns (1 fail), `slideIssues` passes `false` for columns (3 fail), `smallTextWarning` ignores the flag (4 fail), and the slide figure is given `column: true` (2 fail).
- m2 resolved: the README now says the 9pt warning comes "この警告の代わりに". It adds the column path, the mixed and `.ts` advice, and the MCP `render_deck` note, which matches ADR 0085's scope note.
- n1 resolved: the message now says "the figure's text size at scale 1" (asserted).
- Merge of origin/main: true at eb1264ff. Since then main has moved by #501 (swimlane). `git merge-tree` with origin/main is clean, and #501 does not touch the deck code.

## Findings
None.

## Checks that passed
- Entry points for the column flag. `lib/present/render-deck.ts:137` passes `true` and `:136` (slide figure) uses the default `false`. `lib/pptx/deck.ts:249` passes `column: true` and `:241` passes no flag. `lib/pptx-deck-edge.ts` (full) and `lib/pptx-deck-selective-edge.ts` (selective) both call `renderDeckPptxEdgeWith`, which calls `slideIssues` at `lib/pptx-deck-edge-core.ts:123`. `pptx-deck-diagram.ts:104` calls `slideIssues` with the same arguments as the edge core. So the selective edge writer has no separate place where the flag is set.
- A mixed figure in a column gets "give the figure more height (fewer callouts); for the other parts, cut items, …". The test asserts this on renderDeck, the edge writer and the CLI.
- CI at eb1264ff is all green: test 1/3, 2/3 and 3/3, golden (examples/out) and ooxml-xsd.
- Mutations were run against `deck-figure-text-size`, `deck-columns`, `pptx-deck`, `slide-figure-warnings` and `present-render-deck`. Each was reverted with `git checkout --`, and none were committed.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 0 / nit 0)
