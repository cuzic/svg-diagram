# PR #475 review (Opus, round 3)

Target: fix/comic-row-deck-bugs @ e00768ce6e610a517283b0c1184503d67934ebca

## Conclusion
All round 2 findings are resolved by behaviour. With `fit: 'width'` a column figure whose problems come only from the deck's column width now falls back to 940 with the `columnFallbackWarning` in `renderDeck`, `pptx-deck` and the edge writer (ADR 0059 D3), and a problem the figure has at its own width still stops the slide. The merge of origin/main (PR #473 chat) resolves `lib/comic/layout.ts` correctly, and ordinary chats and comics in decks draw with no errors. converged: yes.

## Previous round
- M1 resolved: the part-catalog sweep (65 examples) as `{fit: 'width', columns: [{figure}, {text}, {text}]}` gives 0 `renderDeck` errors and 0 edge issues (round 2: 4 figures with errors: `pert`, `causalLoop`, `burndown`, `controlChart`). Those now get a fallback warning. `fill` 3 columns, 2 auto columns and single-figure slides also give 0 errors on both paths (ran).
- m1 resolved: deleting the edge's problem check after the fallback (`lib/pptx-deck-edge-core.ts:80`) fails `test/deck-figure-problems.test.ts`. So do reverting `renderDeckFigure` to `if (first.ok) return first` and narrowing the edge fallback to spec errors only (ran 3 mutants, all killed).
- m2 resolved: `panelSvg` emits one `pc-pN-in` clip per panel. `comic-row-fixes` now asserts that every id is unique on the crowded 4x1 fixture (two clipped people per panel), and the test passes.
- m3 resolved: the ADR 0056 addendum now says each problem keeps its own message (with or without a rule id) and that `serve` keeps the previous slide. The ADR 0059 D3 exception is written down. The error is one summary line per figure followed by the problems' own text (`pptx-deck` on the round 1 repro deck: 1 summary + 12 problems, exit 1, no file).
- n1 resolved: the long suffix is now said once per figure.

## Merge check (e00768ce)
- `git show --remerge-diff`: the only conflict is in `layoutComic`'s `prep`. The resolution keeps the branch's row wrapping (moved into `placeAt`) and uses #473's `slotInfo(dlg, sid)` from `lib/comic/slot-check.ts`, which has the same body as the removed inline `info`. The other #473 changes merged cleanly: `checkDialogueSlots`, `defaultHue` moved to `face.ts`, `slotSvg` moved to `slot-svg.ts`, and the `slotMax` re-export. `emit.ts` keeps the round 2 per-panel inner clip.
- Against main, the PR changes no goldens. CI `golden (examples/out)` passes. `test (1-3/3)` were still pending at review time.
- Targeted tests: `chat-*`, `comic-*`, `deck-*`, `pptx-deck`, `present-render-deck`: 295/295 pass. This includes the new chat-in-deck case (a chat with `chat-self-missing` stops the slide; `examples/chat-draft.ts` draws).
- No false errors: `examples/chat-draft`, `chat-sheet`, `comic-column`, `comic-faces`, `comic-grid` and `comic-row` were each used as a deck slide (alone, in auto columns, and in a `fit: 'width'` column). All 18 cases give 0 errors and a drawn slide. `pptx-deck` writes the file for `chat-draft` and `comic-row` in a `fit: 'width'` column (ran).

## Findings
### n1 (nit): no test covers the edge writer warning about a fallback while the figure still has problems at 940
- Evidence (ran): changing `if (!('issues' in wide) && !wide.problems.length) fallbacks.push(...)` to `if (!('issues' in wide))` in `lib/pptx-deck-edge-core.ts` keeps `test/deck-figure-problems.test.ts` at 7/7. The result is still correct (`pptx: null` with the issues); only a misleading extra warning would appear.
- Fix: optional. In the `hard` case, assert that `warnings` has no entry for `slides[0].columns[0].figure`.

## Other checks
- Interference: the other open PR that touches code, #478 (decision ladder), shares no files with this PR.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 0 / nit 1)
