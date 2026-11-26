# PR #492 review (Opus, round 2)

Target: fix/cover-title-balanced-wrap @ c80b190711e60e9fdae27a158159890765282c4f

## Conclusion
M1 is fixed: the width search now starts at the widest unbreakable unit, and neither the round-1 titles nor a broad sweep split a unit that main kept whole. m1 and n1 are fixed too. But the new m2 clause-mark split (`lib/wrap.ts`, the `pick` branch) cuts at the raw atom after the mark without the wrapper's kinsoku rules, so it can start a line with `」`/`：`/`？` and split a full-width number such as `３．０`, which main never does. converged: no.

## Previous round
- M1: resolved. Checked by running the code. The three round-1 titles now wrap as main does. A sweep of about 47k random 2+ line titles (katakana / kanji runs, hiragana particles, `、`/`：`, Latin words; widths 10–25 em) found 0 breaks inside a katakana / kanji run or a Latin word that main had kept whole. No title got more lines than main, and no text was lost. Reverting `lo` to 0 makes the new M1 test fail.
- m1: resolved. `"第一部\n\n図で伝える"` gives `["第一部", "", "図で伝える"]`, and the test fails if the guard is removed. See m1 below for a trailing `\n`.
- m2: resolved for the plain case. `…運用、そして…` now breaks right after `、`, and the test fails if the branch is disabled. The branch itself has the problems in M1 and m2 below.
- n1: resolved. The README says the wrap does not split words and keeps the last line from coming out short.

## Findings
### M1 (Major): the clause-mark split ignores kinsoku and digits, so a line can start with a closing bracket or mark, or a full-width number is cut
- Evidence (ran, full-width = 1 em, Latin = 0.55 em, `phrase`):
  - `なぜ図で伝えるのか？」という問いから始める設計の話` at 18.6 em: main `…のか？」という問いから | 始める設計の話`, PR `なぜ図で伝えるのか？ | 」という問いから始める設計の話`. The second line starts with `」`.
  - `バージョン３．０の新しい描き方` at 9.5 em: main `バージョン３．０の | 新しい描き方`, PR `バージョン３． | ０の新しい描き方`. `新機能３．５と移行の手引き` at 8 em is cut the same way.
  - A title with `：：` breaks between the two colons, so the second line starts with `：`.
  - Cause: the candidate is any index right after a `CLAUSE_MARKS` atom (`lib/wrap.ts`, the `atoms.forEach` loop). The tail is wrapped on its own (`wrapText(atoms.slice(pick)…)`), so its first atom is a line start that `CANNOT_START_LINE` never sees. `，`/`．` also act as decimal or thousands marks between full-width digits.
- Fix: reject a candidate when the next atom is in `CANNOT_START_LINE` (or is another clause mark), and when `，`/`．` stands between digits. Or move the break past trailing closing marks, the way the greedy wrap keeps them on the line. Add a test with `？」` and one with `３．０`.

### m1 (Minor): a trailing `\n` in a title now adds an empty line
- Evidence (ran): `"題名の例\n"` gives `["題名の例"]` on main and `["題名の例", ""]` in the PR, because `split('\n')` yields a trailing `''` that the new guard keeps. The title block grows by one line and the figure area shrinks. A leading `\n` behaves as on main.
- Fix: drop one trailing empty part (`text.replace(/\n$/, '')`), or keep `''` only between two parts; add a test.

### m2 (Minor): the tolerance is 2 × the widest atom, and a Latin word is one atom, so a title with a long Latin word can get the stub back
- Evidence (ran): `Observability 基盤の運用で学んだ教訓、次へ` at 20 em: balanced wrap alone gives `Observability 基盤の | 運用で学んだ教訓、次へ`. The clause branch replaces it with `Observability 基盤の運用で学んだ教訓、 | 次へ` (a 2-character last line, same as main), because `tol = 2 * max(atomWidth)` is about 14 em here and `limit` becomes `maxWidth`.
- Fix: base the tolerance on one character (e.g. the widest single-character atom, or the font size), not on the widest atom.

## Other checks (no finding)
- Targeted tests (`title-balanced-wrap`, `wrap-phrase`, `deck-cover`): 27/27 pass. The mutations above (revert `lo`, disable the clause branch, remove the blank-line guard) each make one test fail.
- Height: the sweep never gave more lines than main, so the figure box is unchanged except in the m1 case.
- CI at review time: golden (examples/out) passed; test 1–3 were still running.
- Other open PRs: #491 edits `lib/deck-layout.ts` and `README.md` in other hunks; #490 touches other files. No new interference.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 0)
