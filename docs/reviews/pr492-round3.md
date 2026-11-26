# PR #492 review (Opus, round 3)

Target: fix/cover-title-balanced-wrap @ 46a677dc991b68823acdc649d774101318787384

## Conclusion
All three round-2 findings are fixed, and running the code confirms it. The clause-mark split now obeys kinsoku and keeps full-width decimals whole, a trailing `\n` adds no line, and a long Latin word no longer widens the tolerance. Sweeps found no text loss, no extra lines, no overflow and no new unit splits. The only thing left is a weakness that main already has: full-width digit runs are not glued. That is outside this PR's scope and is noted below as a follow-up. converged: yes.

## Previous round
- M1: resolved. Checked by running the code. At 18.6 em, `なぜ図で伝えるのか？」…` no longer starts a line with `」`. `バージョン３．０の新しい描き方` (9.5 em) and `新機能３．５と移行の手引き` (8 em) keep `３．０` / `３．５` whole, and `：：` is not split. A random sweep of 50k kinsoku-heavy titles (`？」`, `！？`, `：：`, closing brackets, small kana, `ー`, `３．０`, `１，０００`, spaces, `phrase` and `bunsetsu`, 6–24 em) found 0 two-line results where the clause branch starts a line with a `CANNOT_START_LINE` char. That includes a space after the mark followed by `」`. The new test fails if the kinsoku check or the digit check is removed (each tried separately).
- m1: resolved. `"題名の例\n"` gives `["題名の例"]`, and `"一\n\n二"` still gives three lines. Across the sweep, no title with a trailing `\n` ended in `''`. The test fails if the `parts.pop()` is removed.
- m2: resolved. `Observability 基盤の運用で学んだ教訓、次へ` (20 em) gives `Observability 基盤の | 運用で学んだ教訓、次へ`, with no 2-character stub. `GraphQL 移行で得た知見のすべて、以上` (16 em) is balanced too. The test fails if the tolerance goes back to the widest atom.

## Findings
None at Blocker / Major / Minor / nit level for this PR's changes.

## Other checks (no finding)
- Rerun of the round-2 sweep (47,472 two-or-more-line titles: katakana / kanji runs, particles, `、`/`：`, Latin words, 10–25 em). Results: 0 splits inside a unit that main kept whole, 0 extra lines, 0 lost text, 0 overflow, 0 new kinsoku line starts. All 240 short last lines also come out short on main, because the whole title is one or two unbreakable units (for example `コミュニケーションマイクロサービス|移行`).
- Kinsoku sweep with 3+ lines. A few gibberish inputs give a closing bracket or small kana at a line start, or `『「` at a line end. Examples: `っッ」` runs; a space before `」` (`…のか？ 」…` at 10.6 em). These all come from `wrapText` at the narrower balanced width, not from the clause branch, and the same inputs do the same on main at a nearby width. This is the wrapper's existing behaviour and is not new.
- Follow-up (pre-existing, not this PR): full-width digits are not glued in `wrapText`. A run like `２０２６`, `１，０００` or `３．０` can be split at any width (`１|００か…`). I swept 34.5k titles at the real cover/slide widths (18.6, 21.7, 26, 31.6 em). The PR splits a number where main did not in 2,323 of them, and main splits one where the PR does not in 2,028. So the PR changes which titles are hit, but not how often. Half-width numbers (`1,000`, `3.0`, `2026`) are one atom and were never split. Treating full-width digits (with `，`/`．` between digits) as a script run in `scriptRun` would fix this for both `wrapText` and `wrapBalanced`. That belongs in its own PR.
- Targeted tests (`title-balanced-wrap`, `wrap-phrase`, `deck-cover`): 30/30 pass. I applied four mutations one at a time: kinsoku guard, digit guard, trailing-`\n` pop, tolerance filter. Each makes exactly one test fail.
- CI at review time: golden (examples/out) passed. test 1–3 were still pending.
- Other open PRs: #491 touches `lib/deck-layout.ts` and `README.md` in other hunks. #493 and #488 touch `README.md` only. None touch `lib/wrap.ts`.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 0 / nit 0)
