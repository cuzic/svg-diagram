# PR #478 review (Opus, round 1)

Target: feat/decision-ladder-u1 @ b51a7c6fd4fda1c058b9e42698aa07ba062d13f6

## Conclusion
The ladder draws correctly for the ADR's own examples: 272 generated cases (1/2/3/5/8 steps, short/mid/long questions and answers, box/diamond, normal/compact, width 640/900, sub/tone) put every answer on its question's row, every arrow as a 2-point line, and every text inside its box, and the 5-step figure works on a 16:9 deck slide and exports to PPTX as editable shapes. But four Major problems remain. (1) A "no" word of 4 characters or more under a short question makes the figure fail its own check. (2) The `NoFit` path misses widths that fit and suggests a width that is too small. (3) The wrap choice ranks "no short last line" above "fewest lines", which is the reverse of ADR D2. (4) Neither the tests nor the check catch an answer that is off its row or past the band. converged: no.

## Previous round
n/a (round 1)

## Findings

### M1 (Major): a short question with a "no" word of 4 characters or more makes the figure fail its own check (label overlaps label)
- Evidence (ran): `decisionLadder([{q: 'A?', yes: 'x'}, {q: 'B?', yes: 'y'}], 'Z', {yes: '可', no: '該当しない'})` at `width: 640` → `check` problem `decisionLadder: label "該当しない" overlaps label "可"`. The same happens with `{yes: 'Yes', no: 'Not yet'}`, `{no: 'いいえ（不可）'}` and `{yes: 'はい（該当する）', no: 'いいえ（該当しない）'}` (build refuses: "overlaps label … by 97x2px"), in normal and compact. The default はい/いいえ under short questions already overlap vertically by 2px and miss each other only horizontally.
- Cause (read): `lib/ladder.ts` `gapFor` lets the no chip (at `cx + noPad`) reach past the question column into the gap. The next row's yes chip sits at `mid - lh/2 - 3`, which on a one-line row is above the row top, inside `vGap`. `vGap = max(32·space, lh + 10·space)` only budgets the no chip, not the yes chip that rises into the same strip. The error also gives no fix.
- Fix: make the geometry rule out this overlap. Either budget the yes chip's rise in `vGap` when the no chip reaches the gap, or widen the gap so the yes chip starts right of the no chip's right edge. Add a test with a short question and a long `no` that passes `check` with 0 problems.

### M2 (Major): the `NoFit` path rejects widths that fit and suggests a width that does not help
- Evidence (ran): one step `{q: '利用者カードを持っている？', yes: 'カードで受け付ける'}`. Width 290 fits, width 300 throws, width 310 fits again. At 300 the message is self-contradictory: "does not fit 260px. tried: two columns … 250px wide". With `keepWords: true` and long katakana, `diagram({width: 640})` and `660` both say `fix: widen the figure (diagram({width: 640}))`, a width the caller already has. 680 fits.
- Cause (read): `lib/ladder.ts:62` calls `widerThan([...])` without the 40px margin. `states` passes `widerThan(fitted.tried, 40)` (`lib/fit-width.ts:242`). The candidate loop caps the answer column at `floor(room)`, but `measureNode` returns boxes up to `grid4`/`MIN_W` wider than the cap, so every `a.w > room` check fails near the edge. The fallback then measures at 80/80, which fits.
- Fix: pass the 40px margin to `widerThan`. Make the search monotonic, for example by also trying the narrowest wrap (the one the error reports) as a candidate, or by comparing measured widths rather than caps. Add a test that a ladder fitting at width W also fits at W+10, and that the suggested width is greater than the current one and makes the figure fit.

### M3 (Major): the wrap choice ranks "no short last line" above "fewest lines", the reverse of ADR D2 and of the code's own comment
- Evidence (ran): `q1 = '本'×24 + '？'`, `q2 = '書'×22 + '？'` at width 900. The ladder picks a 212px column (q1 13/12, q2 13/10 characters), h 212. With `q2` on one line (column ≈ 352), the figure would be about 20px shorter. The 23-character `q2` was wrapped only so that `q1`'s last line has 4 or more characters.
- Cause (read): the comparator in `lib/ladder.ts` (`best = cands.reduce…`) tests `tailOk` before `h`. ADR D2 says "行数が最小のうち、最後の行が短すぎない（4 字以上）幅" (fewest lines first), and the comment above the loop says "the shortest figure wins, among them a wrap that leaves no stray last line".
- Fix: order the comparison as `h`, then `tailOk`, then narrower `q.w`. Add a test where the two orders give different results.

### M4 (Major): no test, and no check, catches an answer off its question's row or a box past the band
- Evidence (ran, mutations on `lib/ladder.ts`, `node --test test/decision-ladder.test.ts`):
  - Answer placed at the row top instead of centred (`y: top`): 18/18 pass. On the long-text figure, the yes arrow of row 3 then ends in empty space below the answer box, and `check --strict` passes (✓).
  - `if (a.w > room) continue;` removed: 18/18 pass. At width 300 the answers reach x=294 while the band ends at 280, with `check` problems `[]`.
  - Figure not centred (`x0 = x`): 18/18 pass. `gapFor` ignoring the no chip: 18/18 pass, which is the M1 path.
- Fix: in the tests, assert for every row that `q_i` and `a_i` share a vertical centre equal to the yes arrow's y, and that the yes arrow's end lies on `a_i`'s left edge. Assert that every anchor lies within `[t.x, t.x + t.w]`, and add a narrow-width case (for example 320/400) for the room check.

### m1 (Minor): the first row's yes chip sits 7px above the band (`y` 13 vs band top 20)
- Evidence (ran): in every box-question case, `labels[0].y = band.y - 7`. Below a caption, a box or another ladder there is still 8–9px of space, so nothing overlaps today. But the band rect (what `areas`, `reveal` and the band stacking use) does not contain the chip, and `statesProblems` checks labels only on x (`outsideX`).
- Fix: start the first row `lh/2 + 3` lower when its yes chip would rise above `y`, or include the chip in the band's top.

### m2 (Minor): `otherwise` objects are not checked
- Evidence (ran): `{label: 'Z', foo: 1}` is accepted silently, while steps reject unknown keys. `{label: 'Z', sub: 3}` throws the raw `text is not iterable`.
- Fix: check the keys `label` / `sub` / `tone` and that `sub` is text, with the same wording as the step checks.

### m3 (Minor): the ADR text and the ADR status line no longer match the PR
- ADR D1 says the anchors can be reached from "`connect()` や `focus`", but the PR rejects `focus` (open question 3). D2's NoFit fix still lists "`maxNodeW` を狭める" (open question 1). The status line still says only 承認 (Accepted). Now that the ADR is on main, this PR should update it: add "U1 実装済み (PR #478)", amend D1 to drop `focus` (or say it comes later), and amend D2 to drop `maxNodeW` from the fix.

### n1 (nit): the question column can exceed `maxNodeW` by up to 4px
- A 24-character question gives a 364px column with the default cap of 360, because `grid4` rounds up the measured width. Harmless; mention it in the README in U2 or clamp it.

## Other checks (no finding)
- 16:9 deck (`renderDeck`, `.ts` figures at `width: 640`): 5-step box, 5-step diamond, long texts with a lead, English, and 8 steps all render with `errors: []`. The 8-step figure is small, which is expected and left to `aspect-tall`. PR #475 makes figure problems deck errors, so M1 would surface there as a deck error. It is not silent, but valid input should not fail.
- PPTX (`svg-diagram pptx`): box: 22 `<a:t>`, 10 connectors, 0 `<p:pic>`. Diamond: diamonds are `custGeom` shapes, still 0 `<p:pic>`. Everything is editable.
- Errors: `focus`/`dir`, an empty `otherwise`, a non-text `q`/`yes`, `maxNodeW < 80` and a bad tone all throw with the `decisionLadder()` name. Two ladders, or a ladder plus `flowchart` id `q1`, without `scope` give "duplicate anchor id "q1"". Suggest mentioning `scope` in U2's README.
- `pnpm typecheck` passes; `test/decision-ladder.test.ts` passes 18/18. CI: golden and test 2/3 and 3/3 pass, test 1/3 is still pending.
- Other PRs: #473 also adds lines to `lib/dsl-pure.ts`, `test/fixtures/dsl-exports.json`, `public-exports.json` and `test/spec.test.ts`, and #477 to `test/spec.test.ts`. Expect textual conflicts only.

## Open questions (recommendations)
1. Dropping `maxNodeW` from the NoFit fix: agree, because the search already goes down to 80px. Amend ADR D2 (m3).
2. `maxNodeW` default 360: agree. Document it in U2.
3. Throwing on `focus`/`dir`/`returns`/`initial`/`straighten`: agree for U1. `focusGraph` can reorder or drop states, which would break `layoutLadder`'s `q1 a1 … otherwise` order assumption. Amend ADR D1's "`focus` から指せる" (m3).
4. Row height set by content (no arrows of slightly different lengths): agree, because it matches D2 "行の中で上下の中央".
5. ADR status line: update it in this PR, since the ADR is now on main (m3).

## Verdict
converged: no (Blocker 0 / Major 4 / Minor 3 / nit 1)
