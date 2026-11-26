# PR #478 review (Opus, round 2)

Target: feat/decision-ladder-u1 @ fe14a8a9761d7e7da33f4505d4577b672a4c3b28

## Conclusion
All four Majors and the three Minors from round 1 are fixed, and I checked each one by running the code. The 272-case probe now flags 0 cases. A new sweep of 288 label cases finds no overlaps and no problems. A NoFit sweep over widths 200–760 is monotone, and every width the error suggests is wider than the current one and fits. But CI is red. After the merge of main, the PR pushes the `./browser` bundle 3,801 bytes over the budget that ADR 0080 fixes (Q22, 1,067,008 bytes, "増やさない"). The other findings are narrow test gaps and a leftover nit. converged: no.

## Previous round
- M1 (long "no" word overlaps the next yes chip): resolved. `{yes:'可', no:'該当しない'}`, `Yes/Not yet`, `はい（該当する）/いいえ（該当しない）`, a long yes word, and a per-step `noLabel` all pass. I ran them under short and mid questions, beside 1-line and tall answers, as box and diamond, normal and compact, at 480/640/900: 288 cases, 0 problems, 0 chip/box/edge overlaps, everything inside the band. The only throws are legitimate NoFits (diamond, long yes word, width 480). The "rise zero" and "no chip midway" mutations fail 2 tests and 1 test.
- M2 (NoFit not monotone, suggestion too small): resolved. For the one-step case, 280 throws and suggests 300; 290, 300 and 310 all fit. With `keepWords` and katakana, 640 and 660 both suggest 680, and 680 fits. The sweep (mid/long/katakana × box/diamond × normal/compact × keepWords, widths 200–760 in steps of 10) has 0 non-monotone widths and 0 suggestions that fail. The "widerThan no margin" mutation fails 1 test.
- M3 (tail rule ranked above line count): resolved. The 25/23-character case keeps q2 on one line (h 192), as amended ADR D2 says ("行数を増やしてまで最後の行を直すことはしない"). The "comparator tail first" mutation fails 1 test.
- M4 (no geometry tests): resolved. The round-1 mutations now fail tests: answer `y: top` 1, room check removed 1, not centred 1, `gapFor` ignoring the no chip 1.
- m1 (first yes chip above the band): resolved. The probe's band-containment check is clean in all cases, and the "first row no rise" mutation fails 2 tests.
- m2 (`otherwise` not checked): resolved. `{label, foo}` → "`otherwise` has an unknown option 'foo' (label, sub, tone)". `sub: 3` → a text error, no longer a raw TypeError.
- m3 (ADR text): resolved. The status line says U1 is implemented, D1 drops `focus` and lists the rejected options, and D2 drops `maxNodeW` and states the order. One leftover is noted as nit n2.
- n1 (column wider than `maxNodeW`): not resolved. A 24-character question still gives a 364px column at cap 360. A 13-character question at `maxNodeW: 200` gives 210. The new `colW` clamp only covers grid rounding, but `measureNode` itself returns a box wider than `max`. The "colW plain grid4" mutation passes all tests. This stays a nit.

## Findings

### M1 (Major): the PR pushes the `./browser` bundle over the ADR 0080 budget, so CI test (1/3) and (2/3) fail
- Evidence (ran, and CI run 45744622621): `node scripts/bundle-size.ts` at the head gives `./browser 1070809` against a budget of `1067008`, which is "上限を 3801 バイト超えました". Test 726 (`test/side-effects.test.ts:59`) fails for the same reason. `origin/main` (a5b6061a) measures 1,063,836, so main passes with 3,172 bytes to spare and the PR adds about 6,970 bytes. Round 1's head passed only because main was smaller before the chat merge. ADR 0080 D12/Q22 fixes the budget at 1042 KiB and says not to raise it ("増やさない").
- Fix: shrink the ladder's share of the browser bundle (for example, shorter message strings, or sharing the fit/measure helpers with `states`), or get the owner's decision to amend ADR 0080 Q22 before raising `bundle-budget.json`. Do not raise the budget silently.

### m1 (Minor): the 4-character last-line rule (ADR D2) has no test that fails without it
- Evidence (ran): the mutation that removes `tailOk` from the comparator (`c.q.w < b.q.w` alone) passes all 31 tests. The test "among wraps with the same number of lines…" (25–30 characters) passes anyway, because the narrower-column tie-break already balances the two lines. In practice the rule rarely decides anything.
- Fix: add a case where two wraps have the same height and the narrower one leaves a 1–3 character last line (for example, two questions with different lengths), or drop the rule and its ADR wording.

### m2 (Minor): no test covers diamond centring or the forced 80px candidate
- Evidence (ran): placing each diamond at `x0` instead of centring it in the column, and removing `if (!widths.includes(MIN_BOX)) widths.push(MIN_BOX)`, both pass all tests. The probe shows correct behaviour today.
- Fix: in the diamond test, assert that every diamond's centre is `cx`, the x of the no arrow. Add a narrow-width case where only the 80px wrap fits.

### n1 (nit): the column can still exceed `maxNodeW` (see Previous round)
- `colW` does not fix it, because the excess comes from `measureNode`. Either clamp at the measure step, or state in U2's README that `maxNodeW` is the wrap width, not a hard box width. The commit message says "列は maxNodeW を格子で超えない", which overstates the fix.

### n2 (nit): ADR D2's row gap formula and a stray indent
- D2 still says "行の間 = `max(32, ラベルの高さ + 10)`", but the code now adds the next yes chip's rise (`lh + pad + rise`). Update the formula. In `lib/ladder.ts`, `    type Cand = …` has 4 extra spaces of indent.

## Other checks (no finding)
- `node --test test/decision-ladder.test.ts`: 31/31 pass. `pnpm typecheck` passes. CI: golden passes, test (3/3) passes, (1/3) and (2/3) fail only on the bundle budget (M1).
- Edge inputs from round 1 (`focus`/`dir`, bad tones, `maxNodeW 79`, non-text `q`/`yes`, null options, duplicate ids without `scope`) still throw with the `decisionLadder()` name. 12 steps, `reveal`, and empty yes/no with diamonds pass.
- Open PRs: only #374 (gantt) is open besides this one, and it touches no ladder or states files. No interference.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 2)
