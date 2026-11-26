# PR #492 review (Opus, round 1)

Target: fix/cover-title-balanced-wrap @ 3dbf0ae874e9b42f6eb6d90ba9bf4da3b2246b93

## Conclusion
The balanced wrap fixes the stub on the last line and keeps the line count, so a title's height and the figure area do not move; SVG, `serve`/`site` and PPTX (including the edge entry) all take the lines from the same `planDeckLayout`, so they stay consistent. But the width search goes below the width of the widest katakana / kanji run, and `phrase` mode then falls back to per-character breaking, so titles that main wrapped at a word boundary now break inside a word. converged: no.

## Previous round
First round.

## Findings
### M1 (Major): the width search goes narrower than the widest katakana / kanji run, so `phrase` mode breaks inside a word that main kept whole
- Evidence (ran, `lib/wrap.ts` `wrapBalanced` with full-width = 1 em, Latin = 0.55 em; cover title, 56 px in 1040 px):
  - `コミュニケーションプラットフォーム移行プロジェクトの振り返り`: main `コミュニケーションプラットフォーム | 移行プロジェクトの振り返り`; PR `コミュニケーションプラットフォー | ム移行プロジェクトの振り返り` (a katakana word split, and a line starting with `ム`).
  - `はじめに：オブザーバビリティプラットフォーム`: main breaks at `：` (the natural break); PR `はじめに：オブザーバビ | リティプラットフォーム`.
  - `国立研究開発法人情報通信研究機構との共同研究成果`: main keeps the 16-kanji run on line 1; PR splits it.
  - Cause: `wrapStyledAtoms` keeps a run together only while it fits `maxWidth`; when `mid` is below the run's width the run "falls back to the characters", and the binary search accepts that because the line count is unchanged. In principle the same fallback can also give fewer lines than the greedy wrap (accepted by `<=`).
  - No test covers a katakana / kanji run in the balanced wrap; all new tests use runs of hiragana or `あ`.
- Fix: start the search at `lo = longestUnitWidth(splitAtoms(part), opts.atomWidth, opts.mode)` (already exported from `lib/wrap.ts`), capped at `maxWidth`, so the balanced width never goes below the widest unbreakable unit; add a test with a long katakana run and one with a `：` break. (Tried locally: the three titles above then come out as main had them, and the 20-character hiragana title still gives 10 + 10.)

### m1 (Minor): a blank line written with `\n\n` in a title is dropped
- Evidence (ran): `"第一部\n\n図で伝える"` → main `["第一部", "", "図で伝える"]`, PR `["第一部", "図で伝える"]`. `text.split('\n')` gives an empty part, `wrapText('')` returns `[]`, and `flatMap` drops it, so the title gets one line shorter than the author wrote.
- Fix: return `['']` for an empty part (or keep main's behaviour for empty paragraphs) and add a test.

### m2 (Minor): the balanced width can move a break off a clause boundary that the greedy wrap happened to hit
- Evidence (ran): `新しいサービスの設計と運用、そしてチームの文化について話します` → main `…運用、そして | チームの…`; PR `…運用、そし | てチームの…`. Main also breaks between hiragana in general, so this is not a regression of a rule, but for titles a break right after `、`/`：` is usually better than an equal split.
- Fix (optional): among widths giving the same line count, prefer a candidate whose breaks follow `、`/`。`/`：`/a space when its widest line is within a small tolerance of the narrowest; or leave it and mention `\n` in the README.

### n1 (nit): the README says the balanced wrap keeps the last line from being "1〜2 字"; the guarantee is only "same line count, narrowest width", and with the M1 fix a long unbreakable run can still leave a short last line
- Fix: phrase it as "lines are made alike in length where the words allow".

## Other checks (no finding)
- Height / slide fit: the line count is never more than the greedy wrap's, so the title block height and the figure box are unchanged (every probe kept main's line count). Headings that fit on one line return early and stay one line.
- Consistency: `lib/present/render-deck.ts`, `lib/pptx/deck.ts` and `lib/pptx-deck-edge-core.ts` all use `planDeckLayout`; atoms are measured in the same batch as before (lines are cut at atom boundaries, so `splitAtoms(line)` gives already-measured atoms).
- Performance: at most 24 `wrapText` calls per paragraph; 0.3–3 ms per title in the probe (first call includes JIT). Fine.
- Ordinary headings (open question): keeping the balanced wrap for headings is reasonable — line count and height stay the same and the change only affects 2+ line headings — once M1 is fixed. Headings that previously wrapped at a long katakana word are the case M1 would break.
- Other open PRs: #491 also edits `lib/deck-layout.ts` and `README.md`, but in other hunks (source limit, `planDeckLayout` wrapper); expect a clean merge. #490 touches other files.
- Targeted tests (`title-balanced-wrap`, `wrap-phrase`, `deck-cover`): 24/24 pass locally. CI: test 1–3 pass; golden still running at the time of review.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 1)
