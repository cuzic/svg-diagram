# PR #490 review (Opus, round 1)

Target: fix/steps-numbered-wrap @ b758bd4b9350ef83717f8591445abbde978272d4

## Conclusion
The PR does what it says for one box: titles that wrapped as "XX / X" beside the badge now lie on one line, and the badge sits above them. SVG and PPTX share `stepBadgeAt`, and the golden figures are unchanged. But each box decides on its own, in `layoutBoxLike`. In a `steps` row, or any row of `box({step})`, some badges sit beside their titles and some sit above, with title baselines about 38px apart. CI is also red because the `./html/bands` bundle is over its budget. converged: no.

## Previous round
First round. Nothing to check.

## Findings
### M1 (Major): badge placement is decided per box, so one row mixes badges beside and above the title, and the title baselines no longer line up
- Evidence (ran): a sweep of `renderDeckFigure` `steps({numbered})` with JA and EN titles, 3/5/6 items and widths 360 to 940, plus a DSL sweep of `row([box({step})...])`, groups, tags and stamps (left, center and right alignment, widths 480 to 960), main vs PR. Mixed rows: 104 of 294 rendered `steps` cases and 48 of 144 DSL cases. Example: `steps` numbered, titles `下見 / 見積作成 / 契約手続 / 発注準備 / 納品確認`, width 700 (the deck range the PR targets). `下見` keeps its badge beside the title (cy 45, first baseline y=49). The other four boxes get the badge above (cy 51, baseline y=87). The same happens with `jaMix` at width 700 (`設計`, `実装` and `公開` beside; the other two above) and with a stamp row at width 800 with right alignment. The 3rd test asserts `stepAbove` only at width 620, where every title fragments, and at width 940, where none does. It never checks a width where only some titles fragment.
- Fix: make the choice per row. In `steps`, if any numbered item needs the badge above, put every badge above, for example with an internal box flag that `steps` sets. Or add a row post-pass in `layout-row` that applies `stepAbove` to every step box once one sibling has it. Add a test at width 700 or 760 that asserts all boxes in the row agree.

### M2 (Major): CI `test (1/3)` fails because the `./html/bands` bundle is over its size budget
- Evidence (read the log): run 45801758638, job 139846515446, `scripts/check-package-bundles.ts:1230` reports `Vite: ./html/bands が 101000 バイトを超えています (101052)`. On main at the same base (8a3a246c), run 45795355297 passes. The new `badgeAbove` and the `stepBadgeGeom` import in `lib/layout-box-like.ts` and `lib/layout-text.ts`, both reached from the html bands entry, add the 52 bytes. The PR's DoD does not mention this step.
- Fix: keep the step-above code out of the html-bands graph (`html-box-band` already refuses step boxes), or raise the budget with a stated reason.

### m1 (Minor): the "≤2 characters" threshold also catches clean word breaks, so many boxes get taller
- Evidence (ran, same sweeps): of the boxes that moved the badge above, 222/566 (spec) and 66/246 (DSL) had no 1-character line beside the badge. They were clean 2+2 kanji splits such as `見積/作成` and `契約/手続`, or English short words such as `Design/it`. In those cases the box grows from 2 lines (h74) to badge row + 1 line (h91): 198 boxes taller in the spec sweep, 66 in the DSL sweep. The PR's own motivating cases are "2 字 / 1 字" and "1 字ずつ", which a `<= 1` test (or "a line beside is 1 character") also covers.
- Fix: use `<= 1`, or move the badge only when the above-layout is no taller than the beside-layout, or when a beside line breaks inside a word that is whole on one line alone.

### m2 (Minor): tests do not pin the guards, the general `box({step})` path, or PPTX
- Evidence (ran mutations, reverted): dropping `alone.length < beside.length &&` leaves 3/3 passing, and so does dropping the `band.icon` guard. Only removing the `TOP_ICON_GAP` from `topShift` fails a test. No test covers `box({step})` outside `steps` (rows, groups, centre/right alignment, tag, stamp), and no test compares the PPTX `step` ellipse with the SVG badge for a `stepAbove` box. I read the PPTX path: `boxXml` derives `tIns` from the shifted `lineYs[0]`, and the ellipse comes from `stepBadgeAt`, so the PPTX is consistent today.
- Fix: add one test each for the alone-vs-beside guard, an icon box, a centred `box({step})` row, and the PPTX badge y against the text inset.

### n1 (nit): very narrow boxes still fragment
- Evidence (ran): `steps` with 5 items at width 360 still draws `見/積/作/成` with the badge beside, because the title fragments even without the badge, so `alone.length < beside.length` is false. This is not a regression, and no check warns about it.
- Fix: none needed in this PR. A later check could warn when a numbered step title breaks into 1-character lines.

## Other checks (no finding)
- Blast radius: the rule changes every `box({step})`, not just `steps`. In the DSL sweep, 84 of 144 cases changed layout. No case gained a new `verdict.problems` entry, none produced NaN, and no badge overlapped its title: the badge bottom is always above the title's ascent. In the rows I inspected, connectors moved only where row height changed. Golden CI (examples/out) passes with no diff.
- Simpler fix (widen the boxes in `steps` when numbered): it is not available, because `steps` splits the row width equally and the figure width is fixed by the deck. Putting the badge above, uniformly per row (M1) and scoped to `steps`, is the better shape of this fix.
- PR #488 (decisionLadder `numbered`): it touches none of the files in this PR. Its badges come from `stepBadgeGeom` and `LaidOutStates.badges`, not from `box({step})`/`stepBadgeAt`, so this PR does not change them.

## Verdict
converged: no (Blocker 0 / Major 2 / Minor 2 / nit 1)
