# PR #495 review (Opus, round 1)

Target: fix/flowchart-right-on-slides @ c551b2ba0d642b6c6bd28ed36b921dd2a0706ab0

## Conclusion
The search itself behaves well: in a sweep of every part-catalog example and 40 `examples/*.ts` on slides, only width-sensitive figures (flowchart `dir: right/auto`, a tree with long labels) change, and every change is an improvement (an error becomes a figure, or the text gets larger with no new warning). Explicit spec `width` and `.ts` figures are untouched in the deck paths, and renderDeck and pptx edge agree. But the new internal `width` option leaks into the public options of `svg-diagram/pptx/edge` and `svg-diagram/pptx/deck/edge`, where it overrides a spec's own `width`. The published deck-edge path is also untested, and the PR conflicts with main, so CI has never run. converged: no.

## Previous round
None (round 1).

## Sweep (answers the PR's open question)
I rendered on `origin/main` and on this PR merged locally with `origin/main` (conflict resolved; see M3), 1280×720 slides, `measure: 'font'`, Noto Sans JP:
- All 121 `partCatalog()` examples, plus 18 two-part combinations and flowcharts (`right`/`auto`/`down`, 3 or 5 nodes, explicit `width` 600/940). Each ran in 3 slide contexts (title only / title+lead / title+lead+2 callouts) through `renderDeck`, and in 2-column auto shares (figure + text). Same set through `renderDeckPptxEdgeWith` + `planFigureEdge`. 332 renderDeck cases and 249 edge cases.
- Each catalog example stacked three times, to make it bound by its height (130 of 249 cases are height-bound with k < 1.1): **0 changes**.
- Each catalog example with every label lengthened: 1 change (`tree` + callouts: 940 `right` with an `auto-fit-applied` warning → 1056 `down`, k 1.039 → 1.106, warning gone).
- 40 `examples/*.ts` as slide figures, 3 contexts: **0 changes** (`!source` keeps `.ts` out of `fill`).
- Explicit `width` (600 / 940), in renderDeck and edge: unchanged. `width: 940` + `dir: right` still errors, as D7 says.
- Columns: no changes. Column rooms are at most 858 px (2–3 columns, share 3:1), so `wideWidths` is empty.
- Changed cases (renderDeck and edge agree on k and pt): `flow-right` ×3 contexts (error → 1056×76, k 1.106). `flow-auto` + lead (940×508 stacked k 1.089 → row k 1.106). `flow-auto` + callouts (k 0.892 → 1.106; minTextPt 9.36 → 11.61). I looked at the slides as PNG: the row in a tall room is a centred strip with empty space above and below it. That reads fine on a 16:9 slide.

Recommendation: **keep it general**. The 1 % gain gate and "no new flags" already limit it to figures whose arrangement depends on width. Parts with a fixed size never change, because a wider canvas does not make them shorter. A flowchart-only restriction would leave out the `tree` case, which improves.

## Findings
### M1 (Major): `prepareSpecLayout`'s new `width` option becomes a public option of `svg-diagram/pptx/edge` and `svg-diagram/pptx/deck/edge`, and it overrides a spec's own `width`
- Evidence: `SelectedFigureOptions = Parameters<typeof prepareSpecLayout>[1] & …` (lib/pptx-selective-edge.ts:11), so `width` is now in the published `DeckEdgeOptions` / `renderPptxEdge` options types. `prepareSpecLayout` replaces `drawOptions.width` and raises `maxWidth` (lib/spec-selective.ts:156-161). Ran on `lib/pptx-deck-selective-edge.ts` `renderDeckPptxEdge` with `{parts:[flowchartPart], width: 1200}` and a slide figure `{width: 600, dir:'right', 5 nodes}` with `fit:'width'`. main: error "does not fit 560px". PR: no issues, laid out at 1200 (scale 0.973). Without `opts.width` the PR still errors at 560. So a caller-level option silently overrides an explicit spec `width`. Through single-figure `renderPptxEdge(spec, eng, {parts, width: 1200})` it goes past the 940 document cap and hides `doc-width`. The PR's own rule ("広い幅は spec の width でなく、デッキだけの内部の指定で渡す") is broken at the public edge.
- Fix: pass the wide width as a separate internal argument, like `planFigureEdge(spec, engine, opts, width)` (e.g. `planSelectedFigureEdge(spec, engine, opts, width?)` → `prepareSpecLayout(spec, opts, width?)`), so `SelectedFigureOptions` does not gain `width`. Add a type-level or runtime test that `opts.width` is not accepted or has no effect.

### M2 (Major): the wide path of the published deck-edge entry (`pptx-deck-selective-edge.ts`, the `./pptx/deck/edge` export) has no test
- Evidence: the new test drives `renderDeckPptxEdgeWith` with the non-selective `planFigureEdge` (test/deck-wide-flowchart.test.ts "the pptx edge writer…"). Mutation: `plan: (spec, guarded, width) => planSelectedFigureEdge(spec, guarded, opts)` (drop the width). `deck-wide-flowchart`, `deck-columns`, `pptx-edge` and `pptx-deck` tests: 77/77 still pass. On the real export, the mutated code makes `dir: right` an error again on the edge, while renderDeck draws it.
- Fix: add a test through `lib/pptx-deck-selective-edge.ts` `renderDeckPptxEdge` with `{parts: [flowchartPart]}`: a 5-node `dir: right` slide has no issues and scale ≈ 1.106.

### M3 (Major, blocks merge): the PR conflicts with main, and CI has never run on it
- Evidence: `gh pr view 495` → `mergeable: CONFLICTING`, `gh pr checks 495` → no checks. #479 (`forSlide`, doc-width dropped for slide figures) changed the same `draw` in lib/deck-render-figure.ts. I resolved it locally by keeping both (`renderDeckSpec(s, cfg, wide)` wrapped in `forSlide`, `widenDiagram` inside `forSlide(renderDiagram(...))`). The resolved tree passes `tsc` and 177/177 deck/pptx/slide-figure-warnings tests, and the sweep above was run on it.
- Fix: `git merge origin/main` (no rebase/force-push), resolve as above, push, and get CI green.

### m1 (Minor): when 940 and every wider width fail, the error still says "does not fit 900px"
- Evidence: 7-node `dir: right` slide (1364 px wide): `✗ slides[0].figure: flowchart(): the figure does not fit 900px.` The slide tried up to 1168, so a figure up to about 1128 would fit. "900px" understates how much room the slide has and how little needs to change.
- Fix: when `wideWidths` was tried, add the slide room to the message (e.g. "…; on this slide up to 1168px was tried").

### m2 (Minor): the fail path takes the first wider width that draws, without comparing scales, and reports `tried: 2` whatever was tried
- Evidence: lib/deck-layout.ts fillSearch `!first.ok` branch returns on the first `d.ok`. If 1056 draws but is height-bound and 1168 is flatter, 1168 is never compared. `tried` is a fixed 2.
- Fix: count `tried` correctly. Optionally continue to the next width when the first success is height-bound, as the height-bound branch does.

### n1 (nit): `chooseColumns` draw callbacks still build `{...spec, width: w}` for any `w`
- Evidence: lib/present/render-deck.ts:89, lib/pptx-deck-edge-core.ts:90, pptx-deck-diagram.ts. With `w > 940` this would be a spec error rather than a wide layout. It cannot happen today, because column rooms are at most 858 px.
- Fix: route `w > DOC_LAYOUT_WIDTH` the same way as the single-figure paths, or add a comment that column rooms never exceed 940.

## Verdict
converged: no (Blocker 0 / Major 3 / Minor 2 / nit 1)
