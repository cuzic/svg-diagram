# PR #488 review (Opus, round 2)

Target: feat/decision-ladder-numbered @ b22151072f39895405c9b547a6f4473ce46e600e (scope: d92633fc..b2215107, mainly b2215107)

## Conclusion
The gap floor, the PPTX grouping, the docs and the test fixes are correct, and the probes find no new overlap. Two Majors remain. First, the new `ladder-height-bound` advice is often wrong: the "narrow to N" branch makes the text smaller in almost every case, and N (the narrowest width at which every `sub` fits on one line) is often not the best width, because at N the question column wraps again. Second, CI is red on this head: the `decision-ladder` spec bundle is over its esbuild budget. converged: no.

## Previous round
- m1 (gap floor): resolved. `needed` is now 0 without a no chip. Ran: 5 steps with `yes: '', no: ''` at 640 gives a 20px gap, and with words 25px. Both are tested. See m1 below for compact.
- m2 (`compact` advice): resolved. The message, rule doc, schema, README and skill reference no longer recommend it, and the test asserts `doesNotMatch(/compact/)`.
- m3 (name the width): partly resolved. The finding now names `diagram({width: N})`, and N always puts every `sub` on one line (0 failures over the user's shape and 20 random ladders). But the advice built on N is often wrong (M1).
- m4 (PPTX badge grouping): resolved. Ran `planSlide`: each numbered question is a `node` group holding its `box` and its `step` ellipse (5/5). The group rect equals the box. All 20 connectors still glue to existing `box` ids (0 dangling). Without `numbered`, nothing is grouped differently.
- n1 (unreproducible 13.55pt): resolved. The ADR memo now says which case was measured (`.ts` 940 → 13.05, JSON `fill` 827 → 14.18).
- n2 (vacuous assertion): resolved (removed).

## Findings

### M1 (Major): `ladder-height-bound` gives wrong advice. "Narrow to N" shrinks the text, and N is often not the best width.
- Evidence, the user's shape (the test `STEPS`, 1280×720 deck slide with a title only; size from `probe/udeck.ts`, which matches `min(1168/W, 578/(h+40))` at every width):

  | width | finding says | text at that width | text at N = 776 |
  | --- | --- | --- | --- |
  | 640 | widen to 776 | 12.97pt | 13.76pt (but 792–860 gives 14.18) |
  | 776–784 | height binds, width does not help | 13.76pt | (792 gives 14.18) |
  | 800–860 | narrow to 776, "the slide is bound by width, so narrowing enlarges" | **14.18pt** | **13.76pt (smaller)** |
  | 880 | narrow to 776 | 13.94pt | 13.76pt (smaller) |

  Cause: at the narrowest one-line width (band 736), the question column is 196px instead of 210, so `利用者カードは持っている？` wraps to 2 lines. q heights are 56,56,36,56,36 at 776 against 36,56,36,56,36 at 792, so h is 401 against 388. The "narrow" branch is also self-contradictory. At 800 the message says "高さ 428px が幅 800px の 0.54 倍（0.47 倍まで）" (height-bound by the PR's own model) and then "スライドでは幅で大きさが決まっている". Narrowing a height-bound figure cannot lower its height. Random sweep (`probe/r2/rand.ts`, seeds 7 and 42: 20 ladders of 3–8 steps, random q/answer/sub lengths, 40% numbered, widths 420–1000 by 20): "narrow" was said 178 times and gave no larger text in 175, for example a 1.350 → 1.154 scale (about 14.2 → 12.1pt) for one ladder at every width 540–900. "Widen" was said 256 times and gave no larger text in 45. "Height binds" was said 53 times while another width was at least 1% larger in 21.
- `lib/verify-flowchart.ts:12-19` (the 3-way branch on `b.w` vs `oneLineW`); `lib/ladder.ts:119-127` (`oneLineW` = narrowest one-line width).
- Fix: search for the width that gives the least height (the narrowest band width whose `h` equals the minimum `h` over the search). Name it only when it is lower than the current `h`, as "widen/narrow to N: the height drops from X to Y". Otherwise say that the height binds. Drop the "the slide is bound by width" wording (a figure that trips `tooTall` is height-bound by definition). Test that the text size at N is larger than at the current width for the 800–860 case.

### M2 (Major): CI is red on this head. The `decision-ladder` spec bundle is over its budget.
- Evidence: run 45802179742, test (1/3): `esbuild: Spec catalog: decision-ladder が 170000 バイトを超えています (170951)`. d92633fc and b741c6fc were green, so the `oneLineW` search and the new message (plus the main merge) pushed it over. golden, pptx-golden and test 2/3 and 3/3 pass.
- Fix: raise the `decision-ladder` budget in `scripts/check-package-bundles.ts` with a note of what grew, or make the M1 fix smaller than the code it replaces.

### m1 (Minor): a ladder with no no-words packs to 15px in `compact`, so the "no" arrow is mostly arrowhead.
- Evidence: `probe/r2/probe-ladder*.ts` (with the label variants `['はい','']`, `['','いいえ']` and `['とても長いはいの言葉です','']` added): 4-step ladders at 640 in `compact` with `no: ''` (box, numbered, diamond) have vertical arrows of 15px (`GAP_FLOOR * sp` = 20 × 0.75). The filled head is 12px (`FILLED_ARROW_LENGTH`), which leaves about 3px of shaft. No overlap and no finding. It is as documented ("20px, density の倍率を掛ける").
- Fix: floor the gap at 20px without multiplying by `sp` (or at head + 8), or say in the docs that compact gives 15.

## Checks run
- `node --test test/decision-ladder*.test.ts test/rule-locations.test.ts`: 124/124 pass locally.
- Overlap probes rerun, with the yes-only, no-only and long-yes-only label variants added: 296 + 192 + 296 cases. 0 overlaps, misaligned rows, chips off their arrows or badge collisions. The only flags are the 15px arrows (m1) and the 4 known `NoFit` throws (12-step long diamonds at 420).
- Named width: in every case the finding named (user's shape and 20 random ladders), each answer's `sub` is one line at N.
- Open PRs: only #479 touches a shared file (`lib/rules.ts`), as in round 1. #490, #491 and #492 do not touch the ladder, PPTX states, verify or bundle files.

## Verdict
converged: no (Blocker 0 / Major 2 / Minor 1 / nit 0)
