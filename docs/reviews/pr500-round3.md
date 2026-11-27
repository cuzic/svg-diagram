# PR #500 review (Opus, round 3)

Target: feat/callouts-string-table-flex @ eda8af1daeaefeab276bc2611fe7df384efa23ab

## Conclusion
All four round 2 findings are fixed, and I checked each one by its behaviour. The file paths now validate the deck as written and convert it afterwards. Every deck entry I ran (`validateDeck`, `loadDeck`, `loadDeckSelective`, `pptx-deck`, `site`, `serve`, both edge PPTX entries) gives the same places and the same messages for the same input. No path converts a string callout twice, and none lets a string reach the renderer. converged: yes. One nit is left: the C1 section of the PR body still names the old error place.

## Previous round
- M1: resolved. I ran a deck with string callouts (over 300 characters, blank, `"x: "+301`, U+0001), object callouts, a `.ts` figure slide, a cover with callouts, 4 callouts, a non-string non-object item and a `$schema` field. It went through `validateDeck` (raw JSON), `loadDeck`, `loadDeckSelective`, `renderDeckPptxEdge` (full and selective), `bin/svg-diagram pptx-deck`, `site` and `serve`. All of them gave the same 10 issues in the same order: string callouts at `slides[i].callouts[j]` with the hint, object callouts at `.text` with no hint. The `.ts` stand-in (`title: '-'`) still works on the raw slide (`lib/deck-file.ts:66`). Mutations: building `checked` from `resolved` again, `loadDeck` or `loadDeckSelective` validating `read.loaded.deck`, and dropping the hint each fail the new test in `test/deck-callout-string.test.ts`.
- m1: resolved. The new test pins `rows: [{}]` → `parts[0].rows[0].cells: is required`. Reverting the one-object fallback in `lib/spec-validation.ts:75` fails 2 tests. The PR body's "round 2 への対応" lists `decisionLadder.otherwise`, mindmap `tags` and table `rows`.
- m2: resolved. With the label limit raised to `CALLOUT_LABEL_MAX + 5`, the test fails (61-character case). With the digit guard on the left side only, it also fails (`第3：説明`).
- m3: resolved. The hint now only says how the string was read (`lib/deck-spec-core.ts:13`), with no `{"text": …}` remedy. It still helps on the one confusing case: on `"x: "+y×301` the count (301) is the text part, not the whole string, and the hint explains why. README line 75 matches. It keeps the object form as the way to stop a split, which is right as general advice and is no longer attached to the errors. It also lists `pptx-deck` / `serve` / `site` / MCP for the placement, which I confirmed on each.

## Findings

### n1 (nit): the C1 section of the PR body still says string callout errors are placed at `callouts[i].text`
- Evidence: the PR body, "C1" → "変換は … 誤りの場所は `callouts[i].text` など". Since round 1 the place is `callouts[i]` for a string. The later "round 2 への対応" section says this correctly.
- Fix: edit that sentence in the PR body (or the squash message) before merging.

## Other checks
- No double or missing conversion: `readDeckFile` converts once into `loaded.deck`, and `validateDeck` converts its own copy. `withCalloutObjects` returns objects unchanged. A valid deck (`"要点：本文です"`, `"12:30 集合"`, an object with a label, and a string on a JSON-figure slide) loads as objects. In the `.pptx` it is drawn as separate label and text runs (`要点：` / `本文です`, `L: ` / `T`, `見出し: ` / `本文二`), and `12:30 集合` stays whole. In `site` it is drawn as `要点：本文です` in the slide SVG and `slides.json`, with no `[object Object]`. Mutations that remove the conversion in `lib/deck-file.ts` or in `lib/pptx-deck-edge-core.ts:49` each fail a test.
- `renderDeck` takes a `LoadedDeck`, and only the two loaders build one, so it never sees a raw string.
- Tests: `test/deck-callout-string.test.ts` passes 7/7 on a scratch copy of the head. The deck, spec-validation, mindmap, ladder, table, mcp, site, serve and present test files pass with 0 failures (316 passed of 317). CI run 45949204730: golden, ooxml-xsd and test 1/3, 2/3, 3/3 all pass.
- Other open PRs: none touches `lib/deck-file.ts`, `lib/deck-spec-core.ts`, `lib/spec-validation.ts` or `lib/deck-load*.ts`. GitHub reports the PR as mergeable.
- All mutations were made on a `git archive` copy in a scratch directory. Nothing in the worktree was changed except this file.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 0 / nit 1)
