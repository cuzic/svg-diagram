# PR #478 review (Opus, round 3)

Target: feat/decision-ladder-u1 @ 7da1b5fc198492ee00d890e8f1d215cfd71f045e

## Conclusion
The rewrite of `lib/ladder.ts` does not regress the round-1/2 behaviour. All probes are clean, and the round-1/2 mutations still fail tests. I compared the layouts of 1,920 cases against the round-2 code. No case changes between fitting and NoFit, and no case gains a problem. 1,196 cases are identical and 428 move by 4px or less. The budget raise matches the owner's note in ADR 0080. What remains is narrow: removing the `colW` clamp makes some narrow figures taller, there are a few test gaps, and the DSL validation now rejects `sub: ''` and gives less helpful messages. converged: yes.

## Previous round
- M1 (bundle over budget): resolved by the owner's decision (2026-11-26). `bundle-budget.json` is 1,075,200 = 1050 × 1024, the same value as the Q22 amendment note. `node scripts/bundle-size.ts` measures 1,070,590, which leaves 4,610 bytes of room. That is still 3,582 bytes over the old 1,067,008, and the rewrite saved only 219 bytes compared with round 2. `test/side-effects.test.ts` passes 5/5. CI: golden, test (2/3) and test (3/3) pass. test (1/3) was still pending when I wrote this.
- m1 (4-character last-line rule untested): resolved. The mutations "no tail criterion", "tail criterion first" and "`>= TAIL` → `>= 1`" each fail 1 test. The new test is "the 4 character last-line rule…".
- m2 (diamond centring and the forced 80px candidate untested): resolved. Placing each diamond at `x0` fails 1 test. Removing the forced `MIN_BOX` still passes, but the mutation is equivalent: wraps of 80–86px all round to the same 88px column. I checked with a sweep (maxNodeW 250/203/99/85 × 3 texts, widths 200–420). The narrowest width that fits, the boxes and the suggested width were identical with and without the mutation.
- n1 (column wider than `maxNodeW`): resolved through documentation. ADR D2 now says that `maxNodeW` is the wrap width, not a cap on the box width. The clamp was removed (see m1 below).
- n2 (D2 row gap formula, indent): resolved. D2 now gives `max(32, ラベルの高さ + 3 + rise)`, which matches line 81. The stray `Cand` indent is gone.

Regression probes at this head:
- `probe2`: 272 cases, 0 flagged. `probe-ladder`: 272 cases, 0 flagged.
- r2 M1 sweep: 288 cases. The only throws are the 8 legitimate NoFits for diamonds at width 480, the same set as round 2.
- r2 M2 monotone/suggestion sweep: 0 bad.
- The edge inputs, `tail`, `nf`/`nf2` (640 and 660 suggest 680, and 680 fits), `above2` and `clr` give the same results as round 2.
- `node --test test/decision-ladder.test.ts`: 34/34 pass. `pnpm typecheck` passes.

## Findings

### m1 (Minor): removing the `colW` clamp makes some narrow figures taller
- Evidence (ran): 4 long questions (`…かどうかを窓口で確認した？`) with 2-line answers in rows 2 and 4, `{yes:'可', no:'該当しない'}`, `width: 300`.
  - Round-2 code: columns 98/99, height 868.
  - This head: columns 88/100, height 948 (+80px).
  - Cause: `column()` now always rounds the width up to the 4px grid (`grid4`). A 96px wrap becomes a 100px column, which no longer fits the room, so only the 80px wrap is left.
  - Restoring `Math.max(Math.ceil(wd), Math.min(grid4(wd), max))` in `column()` gives 868 again, and all 34 tests still pass.
  - In the 1,920-case diff, 36 cases (all at width 300) are taller. None are shorter, and none change between fitting and NoFit.
  - The cost: about 10 bytes of bundle.
- Fix: restore the clamp in `column()`, or accept the taller figures at very narrow widths.

### m2 (Minor): mutations on the row height and diamond geometry pass all tests
- Evidence (ran):
  - Row height ignoring the answer (`grid4(must(q.lines[i]).h)`): passes all tests. The probes then flag 50/272 cases and r2 flags 23/288. `{q:'A?', yes:<3-line text>}` × 2 at width 480 gives `"a1" overlaps "a2" by 268x28px` and a box outside the canvas. `checkDiagram` reports this, so it is not silent. The only test with tall answers ("a long no word…") uses answers of about 56px, which still fit in the 32px row gap.
  - Drawing every diamond at the column width (`qw = qc.w`): passes all tests.
  - Not centring the text vertically in a diamond (`r.y + (r.h - textH) / 2 - 8` → `r.y`): passes all tests.
- Fix: add a case with an answer much taller than its question that asserts `problems` is empty and that row i's answer ends above row i+1's top. In the diamond test, assert each diamond's own width and its text runs.

### m3 (Minor): the consolidated DSL validation rejects `sub: ''` and gives less helpful messages
- Evidence (ran, round-2 code vs this head):
  - `{q, yes, sub: ''}` and `{label, sub: ''}` were accepted. They now throw `step 1 sub must be text` / `` `otherwise` sub must be text `` (`text(…, k !== 'sub')`).
  - A step that is a string `'abc'` gives `step 1 has no option '0','1','2' (q,yes,sub,…)`.
  - Options given as `'x'` give `options has no option '0'`.
  - The hints were dropped: what `{q, yes}` means, `(got 3; '' puts no word)`, `(got circle)`, and "the ladder is always two columns" on `dir`/`focus`.
  - The option lists are printed without spaces (`q,yes,sub`).
- Fix: let `sub` be blank (as the other `sub` checks do), reject a step or options value that is not a plain object before `Object.keys`, and restore the "(got …)" part and the two-columns hint for `dir`/`focus`.

### n1 (nit): ADR 0080 still states 1042 in two places without the amendment
- Q22 and the note agree, and so does the row at line 203. But the D12 budget table (line 633) still says `./browser` "1042 以下 … 今の +5% 以内" and does not point to the Q22 note. Add the same "(2026-11-26 改訂: 1050 KB)" pointer there.

### n2 (nit): the NoFit message lost its "not tried" line
- The message used to say "not tried: the other direction (a ladder always has the questions down the left…)". That line is gone, so a user who expects `dir` gets no hint. The "tried" height also changed (536 → 572 for the same input), and it still leaves out the row gaps, so it understates the real height. ADR 0083 does not require either, so this is a nit.

## Other checks (no finding)
- Mutations that still fail tests:
  - answer `y: top`: 1
  - room check removed: 1
  - only one answer wrap: 2
  - not centred: 1
  - `gapFor` ignoring the no chip: 1
  - `widerThan` without the margin: 1
  - rise zero: 2
  - first row no rise: 2
  - no chip midway: 1
  - `out.h` without the last box: 7
- Dropping the next row's rise from the row gap passes the tests, and the probes are also clean with it (0/272, 288 with the same 8 NoFits), so it has no visible effect in the swept inputs.
- Inverting the tie-break to prefer the wider column passes the tests. The ADR does not fix the tie-break.
- Open PRs: no other open PR touches the ladder or states files, `bundle-budget.json`, or ADR 0080/0083.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 3 / nit 2)
