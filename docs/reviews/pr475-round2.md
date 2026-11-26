# PR #475 review (Opus, round 2)

Target: fix/comic-row-deck-bugs @ 9eb52e107a23f6d59eeb509c92bfe60e6e94d233

## Conclusion
Round 1 is resolved by behaviour: `serve`/`site` (`renderDeck`), `pptx-deck` and the edge writer now all stop at a figure's problems with the same `slides[i].figure` / `slides[i].columns[j].figure` paths, and both repro decks write nothing (exit 1). No false errors on figures as they are: all 197 `examples/*.ts` as deck slides (alone and in a column) and all 65 part-catalog examples (alone, `fill` columns, auto columns, two equal `width` columns) draw without a problem error. But a deck can still raise a problem the figure does not have: with `fit: 'width'` a column figure is re-laid at the column's px width (ADR 0059), and the problems that width creates are now errors, where ADR 0059 D3 decided "draw at 940, shrink and warn, never an error". converged: no.

## Previous round
- M1 resolved: `pptx-deck` on both repro decks exits 1 with 13 / 3 `✗ slides[0|1].figure: … [comic-*]` lines and writes no `.pptx`; `site` the same ("nothing was written"); edge `renderDeckPptxEdgeWith` with the real `planFigureEdge` returns `pptx: null` with the issues (ran).
- m1 resolved: ADR 0074 now says "least area outside the panel and band"; on the repro deck slide 0, p1.d1 is now 2 lines x 7 chars (was 7 x 2); the kept set has less overflow area (p1.d2 still ends 89px below the panel, but it is reported and the deck stops).
- m2 resolved: deleting the chosen-columns `bad` line in `render-deck.ts`, in `pptx-deck-diagram.ts`, or in `pptx-deck-edge-core.ts`, or the edge fill-path check, each fails `test/deck-figure-problems.test.ts` (ran 4 mutants, all killed).
- n1 resolved (clip rect inset by 1.5px, test asserts it), but it introduced m2 below.

## Findings
### M1 (Major): with `fit: 'width'`, a column figure that is clean as it is becomes a deck error because the deck itself laid it out at the column's width, contrary to ADR 0059 D3 (fall back to 940 and warn)
- Evidence (ran): a deck of one slide per part-catalog example as `{fit: 'width', columns: [{figure}, {text}, {text}]}`: 4 of 65 (`pert`, `causalLoop`, `burndown`, `controlChart`) give `slides[i].columns[0].figure: <label overlap / runs outside the figure / runs out of its node> → the deck is not written …` (`pert` alone 25 lines); the same specs alone, in `fill` columns, in auto columns and in 2 equal `width` columns give none. Same result in `pptx-deck` (no file), `site` (exit 1) and the edge writer (`pptx: null`; with `width: 940` written into the spec it writes). Cause: `lib/deck-render-figure.ts` (columnPx branch: `if (first.ok || narrow.auto === null) return first`) and `lib/pptx-deck-edge-core.ts:71-79` fall back to the document width only on a spec error, then the new problem check rejects the narrow draw. ADR 0059 D3: 「段の幅に収まらない図は、940 で描いて縮め、警告する(利用者の決定。誤りにはしない)」. The message also misleads: "raise width / height" for a figure that has no width (the deck chose it).
- Fix: in both branches, treat problems at `narrow.auto` like a spec error: draw the spec as it is; if that is clean, use it with `columnFallbackWarning(narrow.auto, <first problem>)`; only if it also has problems, report those. One test per path (renderDeck/pptx-deck share `renderDeckFigure`; the edge needs its own).

### m1 (Minor): the edge's non-fill problem check (`fit: 'width'`, or a spec with its own `width`) has no test
- Evidence (ran): deleting `lib/pptx-deck-edge-core.ts:79` (`if (f.problems.length) { issues.push(...) }` after the column-width fallback) keeps `test/deck-figure-problems.test.ts` 4/4 green; the edge test only uses `fit` default (`fill`) and auto columns. Behaviour is correct today (the `causalLoop` run above).
- Fix: add an edge case with `fit: 'width'` (or a figure with `width`) whose plan returns a problem.

### m2 (Minor): the n1 fix emits the same `<clipPath id="pc-pN-in">` once per clipped person, so a row panel with two built-in faces has duplicate ids
- Evidence (ran): `renderComicBand(layoutComic(comic(crowded(), {fontSize: 22}), 0, 0, 940, widthOf))` (the `comic-row-fixes` fixture, 4x1, two people per panel): 28 ids, duplicates `pc-p1-in` … `pc-p4-in`. `lib/comic/emit.ts:30` builds the clipPath inside `personSvg`. Drawing is unchanged (identical rects), but unique ids are an invariant the repo tests (`test/comic-character.test.ts:241`, `test/comic-band.test.ts:53`), and the `.pptx` / slide id rewriting assumes it.
- Fix: emit the inner clipPath once per panel in `panelSvg` (next to `clipId`), or suffix the head id; assert unique ids in the row test.

### m3 (Minor): the error text and ADR 0056 addendum overstate what the message says and what happens
- Evidence (read/ran): ADR 0056 addendum 「問題の文が規則の id と直し方を言う」 and the `figureProblemErrors` docstring, but generic problems carry no `[rule-id]` (label overlap, runs out of its node) and the canvas one carries no fix (`"…" at (684,36) 200x268 exceeds the 800x340 canvas`, repro deck2). The suffix "the deck is not written until the figure is fixed" is wrong for `serve`, which keeps the previous slide (ADR 0056).
- Fix: suffix neutral to the path (e.g. "the slide is not drawn: fix the figure; `svg-diagram check <figure>` shows the same problem"), and reword the ADR sentence to "the problem's own message".

### n1 (nit): one line per problem repeats the long suffix (25 identical tails for one `pert` figure)
- Evidence (ran): width3 sweep above.
- Fix: optional; say the suffix once per figure.

## Other checks
- False-positive sweep: 197 `examples/*.ts` in `renderDeck` alone and as a column figure: 0 problem errors (only the known `wordart` `arc` slide error); `pptx-deck` on the 196 others writes the file. Part catalog: see M1.
- `site` / `pptx-deck` / edge / `renderDeck` agree on paths and on stopping (ADR 0056 D2); the HTML `deck` command already stopped at problems (ADR 0018).
- Targeted tests: `deck-figure-problems`, `comic-row-fixes` 9/9. CI: golden and test 2/3, 3/3 pass; test 1/3 pending at review time.
- Interference: #473 still conflicts with this PR in `lib/comic/layout.ts` (`git merge-tree`).

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 3 / nit 1)
