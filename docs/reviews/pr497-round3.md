# PR #497 review (Opus, round 3)

Target: feat/bars-h-lines-chevron-lanes @ 2e6e564d67ac32826b02b061b4dae9c15e6137f5

## Conclusion
The round-2 crossing is gone. No leader runs through a label any more, and both new tests fail when the fix is turned off. But the fallback now drops the leader and keeps nothing else, so the reader can no longer tell which line a raised label belongs to. Each raised label is about 150 px wide and is centred over two or more dashed lines of the same colour, and `check` stays silent. The chevron m1 fix measures the right thing and the 8 px tolerance is sound. But its new warning tells the reader to reduce `rows`. That makes the arrows narrower, cannot apply to the default one-row layout, and throws on a vertical chevron. The warning also never reaches `check`. The m2 and n1 fixes are fine, and so are the shortened error messages. converged: no.

## Previous round
- M1: resolved as stated. I re-ran the round-2 repro (320 px, two long labels): there are no soft leaders and no crossing. A 3000-input fuzz with a different seed (same generator as round 2) found 0 leaders across a label (round 2 found 263). Making the fallback keep every leader (mutation) fails both new tests. What remains is in M1 below.
- m1: resolved for the measuring. Removing `+ +(w.w > textW + 8)` from `autoPerRow` (mutation) fails the new auto test. Raising the tolerance to 30 px fails 2 tests. The round-2 `'auto'` repro now picks 4 per row and has no warning. The default one-row layout no longer throws. It records `out.wide`, and the warning goes to `verdict.warnings`. What remains is in M2 and m1 below.
- m2: resolved. The lane advice is now `直し方: timeline: 幅を広げる`, and it works: the same long lane name breaks mid-word at 560 and 760 px but not at 940 px.
- n1: resolved. The error says `N 番目のステップ`, and the qc test title matches the behaviour.

## Findings
### M1 (Major): in the fallback, a raised label has no leader and is centred over several lines of the same tone, so a reader cannot tell which line it names, and `check` passes.
- Evidence (ran `checkDiagram`): the round-2 repro (horizontal bars, `width: 320`, `max: 100`, lines at 30 and 38 with labels `Upper limit long label` / `Lower limit long label`). The lines are at x 154.7 and 166.4, both red and dashed. Label 1 is at x 80-229 (row 0) and label 2 is at x 92-241 (row 1, no leader). Each box covers both lines, and the centres differ by 12 px, which the eye cannot use. With three lines (30/38/46), three stacked labels each cover all three lines. The verdict has 0 problems and 0 warnings. The new test asserts no crossing and no problems on exactly this output. Fuzz (3000 inputs): 236 fell back to a raised label with no leader. In all 236 the label box covers another labelled line. 198 of them have no problem and no warning, and 6 of those have only 2 lines. The same holds on the `vlines` path.
- Fix: when `labelRows` falls back and leaves out a leader, report it, for example a `bars` warning such as `基準線の名前「…」をどの線のものか示せない（図を広げる・名前を短くする・tone を分ける）`. Assert that warning in the two-line test.

### M2 (Major): the new chevron warning gives the wrong advice: `rows / perRow を減らす`.
- Evidence: lib/bands/chevron.ts:26. Reducing `rows` puts more steps on each row, so each arrow gets narrower. Only reducing `perRow` widens it. The warning fires on two paths, and the advice fails on both:
  - Default layout (no `rows`, the six Latin steps from the new test, 940 px): the figure already has one row, so `rows` cannot go lower.
  - Vertical chevron (`direction: 'vertical'`, width 300, one 38-letter word): the warning fires the same way. But `rows` and `perRow` on a vertical chevron throw (`縦の chevron は折り返さない`), so following the advice gives an error.
- Fix: phrase the advice by path. Horizontal: `rows: 'auto'`, or raise `rows` / lower `perRow`, or shorten the step. Vertical: widen the figure (`width`) or shorten the step. Assert the advice in the tests.

### m1 (Minor): the chevron warning is a plain string from `verify.check`, so `svg-diagram check` never shows it and `accept` cannot filter it.
- Evidence: lib/core.ts:380-386 turns a `warn` from `verify.check` into a bare string in `verdict.warnings`. It never goes into `verdict.findings`. check-diagram.ts:451 reports only `verdict.findings`. A `.ts` source with the six-step default chevron gives `✓` in text, `{"errors":0,"warnings":0,"findings":[]}` in json, nothing in github, and `results: []` in sarif. So `check` still passes the round-2 m1 case. `diagram({accept: {chevron: '…'}})` leaves the string in place. It is not a `[rule]` string either, so `ruleIds` in lib/deck-layout.ts:341 uses the whole message as the deck flag. That still works, because a different step list gives a different flag and stops the width search, and the deck/build/markdown paths that print `verdict.warnings` do show it. The `cause` band uses the same pattern, so this is older than the PR. But this PR's m1 fix rests on it, and the tests assert `verdict.warnings`, not what `check` shows.
- Fix: emit the finding through `layoutFindings` (or `findings`) with a rule id such as `chevron-text-wide`, so it shows in `check` in every format and can be accepted. Alternatively, record in the ADR/PR that only the render paths show it.

## Checked and fine
- (b) The 8 px tolerance does not let visible overflow through. `textW = cellW - 2·tip - 8` keeps 4 px on each side, so at +8 px a centred line just reaches the notch vertex (x = xx + tip at mid-height), and above or below the middle the notch edge is further left. Probe: one wide step on a one-row chevron, widths 1000-1700 in 1-px steps. The warning turns off at 1314 px, where the left edge of the text is 0.0 px from the notch vertex. At 1313 px the overlap is 0.1 px and the warning is still on. The explicit `rows` / `perRow` error moved from +1 to +8 px on the same grounds. That is a little looser, and still touch-free.
- (d) The shortened errors are acceptable. `rows は 1 以上の整数か 'auto'（指定は …）` and the `perRow` one still name the valid values, and the vertical one still says `rows / perRow を外す`. No test, doc or golden quotes the removed text. Not a regression.
- (e) The fuzz is deterministic. The fixed-seed LCG with `& 0x7fffffff` gives the same sequence on every run: 5000 distinct states, no short cycle, and values spread over 0-6. Inputs and the layout depend only on the seed and the measurer, which is the same one the other tests use.
- Regressions: bars-h-lines, chevron-16, timeline-lane-30 and qc pass locally (88/88). The branch contains origin/main (064997b1). Since round 2 the diff touches only lib/bars.ts, lib/flow-chevron.ts, lib/bands/chevron.ts, lib/flow-types.ts, lib/mid-word-findings.ts and the four tests.
- CI at 2e6e564d: golden, ooxml-xsd, test 2/3 and 3/3 pass. Test 1/3 was still pending at review time.

## Verdict
converged: no (Blocker 0 / Major 2 / Minor 1 / nit 0)
