# PR #495 review (Opus, round 2)

Target: fix/flowchart-right-on-slides @ 0eb375bf22a705973b93d15b7500af28634b85aa

## Conclusion
All three Majors are resolved, and I checked each one by its behaviour. The merge with main keeps #479's problems-as-errors handling. The wide width no longer reaches the public options: `tsc` rejects `width` in `DeckEdgeOptions` and in `pptx/edge` `Options`, and a figure's own `width` still errors as it does on main. The published deck-edge path now has a test that fails when the width is dropped. The main-vs-PR sweep on the resolved head gives exactly the same results as round 1: only width-dependent figures change, every change is an improvement, and no figure gets a new warning or problem. What is left is two test gaps with correct behaviour. converged: yes.

## Previous round
- M3 (merge/CI): resolved. `git show --remerge-diff 8cc773d4` has one conflict hunk in lib/deck-render-figure.ts. The resolution keeps `renderDeckSpec(s, cfg, wide)` inside `forSlide(...)`, and `widenDiagram(...)` inside `forSlide(renderDiagram(...))`. That is #479's `forSlide` plus #495's width. The problems check (render-deck.ts:80, pptx-deck-edge-core.ts:68) runs on whichever draw the search chose. `deck-figure-problems` and `slide-figure-warnings` pass. PR is MERGEABLE, and CI ran on this head (see the CI section below).
- M1 (public `width`): resolved. `prepareSpecLayout(input, options, wideWidth?)` and `planSelectedFigureEdge(spec, engine, opts, wide?)` take the width as a separate argument. A probe passing `{parts, rasterize, width: 1200}` to `renderDeckPptxEdge` and to `renderPptxEdge` fails `tsc` (TS2353 on both). At runtime (cast), a 5-node `dir:'right'` figure still errors "does not fit" with `opts.width: 1200`. A figure with `width: 600` and `fit:'width'` errors with or without the caller's width. Explicit spec widths never enter `fillSearch` (deck-render-figure.ts:41 and pptx-deck-edge-core.ts:58 gate on `width === undefined`), so `doc-width` is not hidden for them: `width: 940` + 5-node `dir:'right'` on the deck edge still errors "does not fit 900px". Mutation: read `options.width` again in `prepareSpecLayout`. Two new tests fail.
- M2 (deck-edge test): resolved. New test drives `lib/pptx-deck-selective-edge.ts` `renderDeckPptxEdge` with `flowchartPart` (no issues, scale ≈ 1.106). Mutation: drop `width` in its `plan`. The test fails.
- m1 (widest-width error): resolved. renderDeck 7-node `dir:'right'` gives "does not fit 1[01]xxpx" (test). On the selective deck edge, a probe gives `slides[0].figure.parts[0] flowchart(): the figure does not fit 1128px.` (was 900px).
- m2 (scale comparison + tried): resolved in code. The fail branch keeps the best `k` (with a 1% gate), stops when a draw is not height-bound or reaches the cap, and counts `tried`. The new fillSearch test (1056 height-bound, 1168 flatter → 1168, tried 3) fails when the comparison is mutated away. See m1 below for the `tried` count.
- n1 (columns past 940): resolved. The `chooseColumns` draw callback returns not-ok for a width over 940, with a comment. Column rooms are at most 858 px, so this cannot trigger today.

## Sweep (resolved head vs `origin/main` e476dcfc)
I used the same harness as round 1: 1280×720 slides, `measure:'font'`, Noto Sans JP. It covers 332 renderDeck cases (121 catalog examples + combinations + flowcharts × 3 contexts + columns), 249 edge cases, 249 tripled (height-bound) cases, 132 long-label cases and 120 `examples/*.ts` cases.
- Resolved head vs the round-1 local merge: identical in all five sets (332/249/249/132/120 the same).
- vs main: renderDeck 5 changes, edge 5 changes (the same 5 cases), long-label 1 change, tripled 0, `.ts` 0. The changes are `flow-right` ×3 (error → 1056×76, k 1.106), `flow-auto` + lead (k 1.089 → 1.106), `flow-auto` + callouts (k 0.892 → 1.106, pt 9.36 → 11.61) and `tree` + callouts (the `auto-fit-applied` warning goes away, k 1.039 → 1.106). None of them adds a warning or a problem.
- Problems: the problems check comes after the search, on the result it chose, so it covers a wide result too. #479's tests pass on this head.

## Findings
### m1 (Minor): two of the round-1 fixes are correct in code but have no test that pins them
- Evidence: I applied two mutations, and `test/deck-wide-flowchart.test.ts` still passes 13/13 under each. (a) Revert m1 on the edge path: `if (w === null) firstIssues = f.issues;` in lib/pptx-deck-edge-core.ts:62. The edge error then goes back to "900px". The m1 test only drives renderDeck. (b) Return `found` without the total `tried` (`return found ? found : first`) in lib/deck-layout.ts:368. The m2 test cannot tell the two apart, because its best width is also the last one tried.
- Fix: add the 7-node case to the selective deck-edge test (`/does not fit 1[01]\d\dpx/`). Add a fillSearch case where the first wide width is the best and is not the last tried, e.g. 1056 flat, 1168 height-bound with smaller k, and require `width === 1056` and `tried === 3`. Under the current break rule, 1056 not height-bound stops the loop, so write the case so that 1056 is height-bound but still the best.

### n1 (nit): the column guard for widths past 940 (lib/deck-layout.ts:457) has no test that would catch its removal
- Evidence: I removed the guard and the tests still pass. The added test only checks that `figureRooms` column rooms are ≤ 940, which is why the guard cannot trigger today.
- Fix: none needed. Optionally, drive `chooseColumns` with a box wider than 940 and check that the draw callback never receives a width over 940.

## CI
All 4 checks green on 0eb375bf: test (1/3), (2/3), (3/3), golden (examples/out). Locally: `tsc --noEmit` clean; deck-wide-flowchart, deck-figure-problems, slide-figure-warnings, deck-columns, deck-round2, present-render-deck, pptx-deck, pptx-edge 117/117. Other open PRs: #493 touches no file of this PR (it edits spec-selective-node.ts, not spec-selective.ts).

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 1)
