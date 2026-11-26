# PR #491 review (Opus, round 1)

Target: feat/slide-source-longer @ bdcb9d1733f41b6bc04b87b04bc9f4d2faed51cf

## Conclusion
The change is small and consistent: one wrapper in `planDeckLayout` turns an over-long footnote into a `slides[i].source` error, and `serve`, `site`, `pptx-deck` and the edge renderer all report the same message (checked by running each path). No Blocker or Major. The weak spots are a wrong PR description, an ADR claim about line counts that does not hold, the 10-line cap having no headroom over ordinary 800-character Japanese text, and an untested `serve` error path. converged: yes.

## Previous round
First round.

## Design assessment (owner's open questions)
- **Footnote size.** Keep 13 px (9.75 pt). The deck's text floor is `MIN_TEXT_PT` = 9 pt = 12 px (ADR 0055 D4, ADR 0056 D2, ADR 0059 D2). 11 px is 8.25 pt, smaller than the 9 pt the deck warns about in figures. It would make the footnote the smallest text on the slide, so the deck would break its own rule. 12 px is the only legal step down, and it saves very little. Measured with an 800-character full-width footnote: 13 px gives 10 lines of 17 px (170 px); 12 px gives about 97 characters a line, so 9 lines of 16 px (144 px). That saves about 26 px, not enough to justify a second size.
- **Multi-column footnote.** This buys no height. Two columns at the same size hold the same characters per row pair, so the block is about as tall. It would only shorten the line, which is long at about 89 full-width characters, so it helps readability but not space. Not worth it now.
- **"2-4 lines" expectation.** No legal size can deliver this for Japanese. At ≥ 9 pt, 400 full-width characters take 5 lines and 800 take 9-10. English fits the expectation: 800 ASCII characters are 4-5 lines at 13 px. The design should say that long Japanese footnotes cost about a quarter of the slide height.
- **10 lines on 720 px.** 10 × 17 + 10 = 180 px, which is 25 % of the slide. That is acceptable because the existing small-text warning fires. Measured: a dense 14-bar figure under a title and lead dropped to 5.5 pt with an 800-character Japanese footnote and got the warning. The cap is in practice a guard against pathological input (long unbreakable Latin words); see m2 for its missing headroom.
- **Array form (`source: string[]`).** Agree with leaving it out. Line breaks would fight the measured wrapping, and the PPTX box already re-flows.
- **Consistency.** I ran the same over-long input through `renderDeck` (`serve` / `site`) and `renderDeckPptxEdge`, and both gave the identical message at `slides[0].source`. A cover with an 800-character footnote draws, as do a slide with columns and a text-only slide. A full slide (long title, long lead, three callouts and a figure) draws with the small-text warning, not an error.

## Findings
### m1 (Minor): The PR description belongs to another PR.
- Evidence: `gh pr view 491 --json body` returns the body of #479 (`doc-width`, `gray-tone-collision`, legend rules, round-1 table). It says nothing about `source`, and the measurements that ADR 0055's addendum points to ("測った値は PR の説明にある") are not there. `merge-pr` and later readers rely on this text.
- Fix: replace the body with this PR's own summary, the tests and the measured numbers (scale and smallest pt for the dense figure, line counts).

### m2 (Minor): The ADR says 800 full-width characters take 9 lines, but ordinary text takes 10, exactly the cap.
- Evidence: I ran an invented 800-character Japanese footnote with normal `、` / `。` through `renderDeckPptxEdge` with real fonts. The source box has 10 lines (top 522 px, height 170 px). An unpunctuated run of 800 `Ｗ` gives 9. Kinsoku line breaking costs a line, so a schema-valid footnote sits at 0 lines of headroom. A slightly wider font build or a fallback face would turn a valid input into an error. ADR 0055 addendum line 90 ("全角 800 字は 9 行で、上限に届かない") is wrong.
- Fix: raise `SOURCE_MAX_LINES` to 11 (or 12), or derive it from `SOURCE_MAX_CHARS` plus one line, and correct the ADR sentence to "9-10 lines".

### m3 (Minor): The `serve` / `site` error path for an over-long source has no test.
- Evidence: I deleted `if (layout.sourceError) { … }` in `lib/present/render-deck.ts:130`, and `test/deck-source.test.ts` plus `test/present-render-deck.test.ts` still pass (8/8). The slide still fails, but with the generic `roomMessage` at `slides[i]` instead of the `.source` message. The same mutation on the PPTX side (`lib/pptx/deck.ts:233`) is caught.
- Fix: add a `renderDeck` case with a source made of long unbreakable words, and assert the error path `slides[0].source` and the "wraps to" text.

### m4 (Minor): The PPTX footnote box re-wraps (`wrap="square"`), and taller footnotes make overflow at the bottom more likely.
- Evidence: `lib/pptx/deck.ts:75` writes measured lines with `<a:br>` but keeps `wrap="square"`. Each line of a long Japanese footnote is about 1157 of 1168 px. If PowerPoint's face is a little wider than the measured one, every full line spills one character and the box grows downward past the 28 px bottom margin. At 2 lines that was a nuisance; at 10 lines it can push text off the slide. Not verified in Office.
- Fix: write the source box with `wrap="none"`, as the cover already does (ADR 0066 D6). A wider face then overruns sideways into the 56 px margin, not off the bottom. Alternatively, check once on the Office VM.

### n1 (nit): The small-text warning does not name the footnote as a cause.
- Evidence: with a long source, the warning reads "split the figure, or move text off the slide" at `slides[i].figure`, so the author is not told that the footnote took the room.
- Fix: when the source has more than about 4 lines, add "or move part of the source to the notes".

### n2 (nit): #492 edits the adjacent README paragraph and `lib/deck-layout.ts` (cover title wrapping).
- Evidence: there is no semantic overlap with `sourceBlock` or `wrapped`, but the README hunks are next to each other, so expect a trivial merge conflict for whichever PR lands second.
- Fix: none needed. Merge `origin/main` after the other PR lands.

## CI
- `test` (1/3, 2/3, 3/3) and `golden (examples/out)`: pass on the reviewed head.
- `pptx-golden` (run 45802468970): fails with "0 changed, 2 new of 203". The 2 new entries are `timeline-marks-only` and `venn-features`, examples that came from `main`; this PR touches no example. No existing PPTX changed, so the failure comes from the stale manifest on `main`, not from this PR. Deck footnotes are not in that golden set at all.
- Run locally: `test/deck-source.test.ts` (6/6) and the deck / pptx / present / schema / site suites (77/77) pass.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 4 / nit 2)
