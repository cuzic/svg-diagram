# PR #505 review (Opus, round 1)

Target: feat/deck-figure-text-size-u2 @ 72182844

## Conclusion
The core of D2 works: on the slide, the labels come out at 19-20px, document figures are byte-identical, and fuzzing found no overflow that the fit tests let through. It does not converge yet. Two configurations break serve/pptx-deck parity (ADR 0056 D2, ADR 0085 D2 M6). The `./browser` bundle is over its budget after merging main, so CI is red. The edge-writer and column paths have no test that fails when they are removed.
converged: no.

## Previous round
None (round 1).

## Findings

### M1 (Major): serve and the `pptx-deck` CLI do not grow labels in two configurations where the edge writer does, so the Worker `.pptx` differs from serve and the CLI
- Evidence: I ran the same deck through `renderDeck`, the CLI and `renderDeckPptxEdge` (JA fonts, invented labels).
  - `fit: 'fill'` (the default) with a spec that gives its own `width` (a 3-set venn with `width: 900`, lead + callout): serve and the CLI draw 14px, 9.11pt on the slide, and give the U1 "under 14px" warning. The edge draws 22px, 14.32pt, with no warning. A 3-ring concentric with `width: 900`: 11.71pt vs 15.05pt.
  - `fit: 'width'` with figure columns: random parity fuzzing (seed 5, 131 decks) found 4 size mismatches, all in this configuration. Serve gives 9.03pt and a U1 warning; the edge gives 14.19pt.
  - Cause 1: `lib/present/render-deck.ts` and `pptx-deck-diagram.ts` pass only `{fill}` when the fit is fill. `renderDeckFigure` skips the fill branch when the spec has a width, and its non-fill path then has `opts.grow` undefined. The edge's non-fill path always calls `grownPlan(..., room, ...)`.
  - Cause 2: in `renderDeckFigure` (`lib/deck-render-figure.ts`), the column path with `narrow.auto !== null` returns `first` without `grown(...)` (`if (first.ok && firstProblem === undefined) return first;`). The edge grows there (`drewNarrow`).
- Fix: in `renderDeckFigure`, use `opts.grow ?? opts.fill` as the room on the non-fill path, and grow the successful narrow-column drawing too. Then add parity tests for both configurations (see M3).

### M2 (Major): `./browser` is over its budget after merging `origin/main`, and CI is red
- Evidence: `pnpm bundle-size` gives:

  | Build | `./browser` (bytes) |
  | --- | --- |
  | Trial merge with `origin/main` (8a617463) | 1,091,143 (budget 1,090,560, 583 over) |
  | Branch alone | 1,090,318 |
  | `origin/main` | 1,089,045 |

  The PR description's "1,074,021" is not what the bundle measures. CI `test (1/3)` fails at `pnpm bundle-size`, and `test (3/3)` fails in `test/side-effects.test.ts:59` ("./browser が上限を 583 バイト超えました"). ADR 0085 D2 (m4) says not to raise the budget and to report it if the change goes over.
- Fix: trim about 600+ bytes from what U2 adds to the browser entry. For example, keep `lib/flow-grow.ts` out of the browser graph, or share the geometry helpers. Otherwise report to the owner for a budget decision. Also correct the number in the PR body.

### M3 (Major): the edge-writer, CLI-column and fallback grow paths have no test that fails when they are removed
- Evidence: I removed each of these and ran `test/deck-figure-text-grow.test.ts` and `test/deck-figure-text-size.test.ts`. All 27 tests still passed each time.
  - the grow in `pptx-deck-edge-core.ts` for columns (`grownColumns`)
  - the grow in its non-fill path (`drewNarrow`)
  - its "new rule id" rejection
  - the grow of CLI columns in `pptx-deck-diagram.ts`
  - `askTextSize` in the `specToDiagram` fallback of `renderDeckFigure`

  The parity test checks only `sizes.some(s => |s - pt| < 0.6)` for one fill slide per part. It cannot see M1.
- Fix: write a parity test over fill, fill with own width, fit width, fixed columns and auto columns. Run each through `renderDeck`, both edge writers and the CLI, and compare the complete set of figure label `sz` values and the U1 warnings.

### m1 (Minor): ADR D2 contradicts itself on when to grow, and the 22px cap is not in the ADR
- Evidence: D2 says "`14 × k` が T を下回るときだけ引き上げる". With T = 14, that means growing only when k < 1. The implementation (`askedTextSize`) grows whenever floor(21/k) > 14, that is when k < 1.4. That matches Q3 and the ADR's own example (concentric at k = 1.115 grows to 18px), but not that sentence. The `MAX_SIZE = 22` cap keeps the effective size at 19.1px when k = 0.868. That is fine, but the ADR does not state it.
- Fix: add an implementation note to ADR 0085 that records the k < 1.4 rule and the 22px cap.

### m2 (Minor): `textSize` is on the public DSL option types, so a `.ts` document figure can set it
- Evidence: `cycle([...], {textSize: 22})` keeps `textSize`, and `placeGrown` then draws a document figure at up to 22px. The types are only marked `@internal`, and `stripInternal` is not set. The JSON spec path correctly rejects it ("parts[0].textSize: is not a known field").
- Fix: set it only on the band (`CycleBand`, etc.) inside the deck path, not on `CycleOpts`/`VennOpts`/`ConcentricOpts`, or strip it from the published types.

### m3 (Minor): the U1 tests lost some end-to-end coverage
- Evidence: the column test no longer covers the mixed advice ("…; for the other parts, cut items") through `renderDeck`, the edge or the CLI. Only the unit test at `test/deck-figure-text-size.test.ts:101` remains. In the "advice follows the cause" test, the same `circle` assertion is now written twice. No test shows that a venn or cycle whose larger labels are refused still gives the U1 warning.
- Fix: in the column test, use a venn or cycle that cannot grow (for example long Latin labels with a callout) next to a stacked part, so that the mixed advice is tested again. Remove the duplicated line.

### m4 (Minor): with columns, the CLI prints the warnings of the first drawing, not of the larger one
- Evidence: `pptx-deck-diagram.ts` prints `chosen.figures[j].value.verdict.warnings` before `growColumnFigure` runs. Serve takes the warnings from the larger drawing. The larger drawing may lose a rule id (only new ids are refused), so the CLI can print a warning that serve does not. I found this by reading the code and did not reproduce it.
- Fix: print the warnings of the drawing that `growColumnFigure` returns.

### n1 (nit): some checks have no test, and a framed cycle never grows
- The centre checks of `concentricFits` and `vennFits` have no test. I removed them and no test failed. Removing both also left the fuzz unchanged, so other checks catch those cases.
- A cycle with a `frame` never grows: the frame's title grows, the figure gets taller and the height guard refuses it. This is on the safe side; mention it in the README line.
- Per-part budget headroom after the merge: cycle is at 73,074 of 73,200 (esbuild) and 96,531 of 96,600 (Vite).

## Verified (no finding)
- **Q3 / D2 table**: the size is `floor(21/k)`, never under 14 and capped at 22. Steps go down by 2px, the margin is 0.92, the height guard and the "k must not fall" guard are there. It applies only to concentric (inside, no sectors), venn, and cycle without links. Candidates are measured only when a size is asked for.
- **Document figures**: I re-rendered all 203 `examples/*.ts` on the trial merge and on `origin/main`. Both outputs are identical. `icons.ts` drifts from the committed copy on both in this environment, so the PR does not cause that. A hash over 120 random concentric, venn and cycle document specs (`renderSpec`) is the same on the branch and on main.
- **Effective sizes, measured again**:

  | Slide | Effective size |
  | --- | --- |
  | venn, lead | 0.960 × 21 = 20.2px |
  | cycle, callout | 0.893 × 22 = 19.6px |
  | concentric, lead | 1.115 × 18 = 20.1px |
  | venn, fit width | 0.868 × 22 = 19.1px |
  | concentric, column | 1.165 × 18 = 21.0px |
  | column already at k = 1.5 | unchanged, 14px |

- **Overflow fuzz**: about 950 random decks (Japanese, katakana and Latin labels; 2-6 rings; 2-3 sets with items, overlaps, centre and universe; 3-8 steps with subs, centre and frame; three room shapes). An independent geometric check looked for text overlapping text, text outside its band, text crossing a circle's outline and arrows through text. It found no problem that the 14px drawing did not already have. With the fit test removed, the same fuzz found 39 overflows, so the check works.
- **Determinism and time**: the same 15-slide deck gives the same SVG hash over runs and processes. renderDeck takes 158 → 171ms with a cold cache and 61 → 67ms warm, about +10%.
- **Side-effects 134 → 139**: justified. The 5 new sites are top-level statements of the CLI script `pptx-deck-diagram.ts` (`figureRooms`, `sharedColumns`, `Promise.all`/`growColumnFigure`). The new `lib/deck-grow.ts` and `lib/flow-grow.ts` have none.
- **Per-part package budgets**: `check-package-bundles` passes on the trial merge.
- **CI**: `golden` and `test (2/3)` pass. `test (1/3)` and `test (3/3)` fail on the bundle budget (M2).

## Verdict
converged: no (Blocker 0 / Major 3 / Minor 4 / nit 1)
