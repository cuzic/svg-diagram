# PR #488 review (Opus, round 1)

Target: feat/decision-ladder-numbered @ d92633fcbe14c7975985cb6fe2748dec5ff2fba5

## Conclusion
No Blocker or Major. `numbered: true`, the even row spacing and the wider answer column all behave as described: 744 probe ladders (1/2/3/5/8/12 steps, short/mid/long questions and answers, box/numbered/diamond, normal/compact, widths 420/640/900, label variants) show no overlap, no misaligned row, no chip off its arrow and no badge touching text, chips or arrows. The spec matches the DSL exactly, and the PPTX draws native `step` ellipses. What is left is accuracy: the "32 to 20px" packing never goes below the label floor (25px), the finding's advice (`density: 'compact'`) gains about 1%, and the finding never names the width that actually helps. That width is the main remaining lever: about 14.2pt against the PR's 13.0 at 640. converged: yes.

## Previous round
First round.

## Findings

### m1 (Minor): `GAP_FLOOR = 20` is dead. The gap never goes below `lh + 3` (25px normal, 24px compact), even with no chips at all.
- Evidence: `lib/ladder.ts` `needed = lh + Math.round(3 * sp) + ...` does not depend on `noW`/`yesW`, and `rowGap(g) = Math.max(g, needed)`. Ran: a 5-step ladder with `yes: '', no: ''` at width 640 still has a 25px gap between boxes. Mutation `GAP_FLOOR = 0`: the layout is unchanged and `test/decision-ladder*.test.ts` still passes 53/53. The PR title, README ("20〜25px まで詰める") and the ADR memo say 20.
- Fix: drop `GAP_FLOOR` and document 25 (the label height), or base `needed` on the chips that exist (`noW === 0` → no chip floor), so a label-less ladder packs to 20.

### m2 (Minor): the finding and the README suggest `density: 'compact'`, which barely helps a height-bound ladder.
- Evidence: test shape (5 steps + final box, two answers with a long `sub`) on a 1280×720 deck slide with a title only, smallest text: at width 640 it is 12.97pt (normal) and 13.11pt (compact); at 900 it is 13.63pt for both. The gaps already sit on the 25px label floor, and compact changes only the gap.
- Fix: drop compact from the message, or make it say the gain is small. The real levers are the width that puts each `sub` on one line (m3), fewer steps and shorter `sub`.

### m3 (Minor): `ladder-height-bound` does not name the width that helps, and it fires where the slide is limited by width.
- Evidence (same deck probe, JSON spec so that `fill` searches): width 640 gives 12.97pt, 760 gives 12.97, 820 gives 14.18, 860 gives 14.18, 900 gives 13.63 (width-bound: area 1168×555), 940 gives 13.05, and `fill` (827) gives 14.18. The best is the narrowest width at which every `sub` fits on one line. At 900 the info still says "幅を広げても文字は大きくならない" (aspect 0.476 > 0.47), but the slide area is 0.48–0.495 there, so the figure is limited by its width, and narrowing it to about 860 would enlarge the text. The README sends readers to `width: 900`.
- Fix: when an answer's `sub` wraps, compute the width at which every answer fits on one line (question column + gap + widest one-line answer + 40) and name it in the message (`diagram({width: N})`). Point the README at the info rather than at 900.

### m4 (Minor): the PPTX badge is a separate top-level shape, not grouped with its question.
- Evidence: `lib/pptx/states.ts` pushes each `step` ellipse after the node groups. `box({step})` puts its badge inside the node's group (`lib/pptx/box-band.ts` `groupXml(..., 'node', ...)`). Moving a question in PowerPoint leaves its number behind.
- Fix: emit the badge inside that question's `state` group (the connectors glue to the group, which does not change).

### n1 (nit): the measured figures in the PR body and the ADR memo cannot be reproduced for "no width given": 13.55pt.
- Evidence: a `.ts` figure without a width is drawn at 940, which gives 13.05pt. A JSON spec without a width (`fill`) is drawn at 827, which gives 14.18pt. The figures at 640 and 900 (12.97 and 13.63) do reproduce.
- Fix: state which case was measured, or replace the number.

### n2 (nit): a vacuous assertion.
- Evidence: `test/decision-ladder-numbered.test.ts` has `assert.ok(subLines(wide.t) >= 0)`, which is always true.
- Fix: remove it, or assert `subLines(wide.t) === 2`.

## Checks run
- `node --test test/decision-ladder*.test.ts test/rule-locations.test.ts`: 121/121 pass.
- Mutation: forcing `clear = false` makes the packing test fail (it is covered). `GAP_FLOOR = 0` makes no test fail (m1).
- Spec parity: `numbered: true` gives the same laid-out band from the spec and from the DSL. `numbered: 'yes'` / `1` are rejected at `parts[0].numbered`. `numbered` with `question: 'diamond'` is rejected with the DSL's message.
- PPTX: 5 `step` ellipses with the accent fill, 12pt numbers and positions equal to the SVG badges. No picture fallback.
- Badge `r` and `size` equal those of `box({step})`. Two-digit numbers (12 steps) stay inside their boxes.
- CI: golden and test 2/3 and 3/3 pass; test 1/3 was still running at review time. Open PR #479 also touches `lib/rules.ts` and merges cleanly.

## On the PR's open questions
- **20px floor / 0.47 threshold**: 0.47 is sound. A title-only slide gives an area of about 0.48, and one with a lead line about 0.46. The packing is graded (it stops as soon as the figure is short enough), so there is no cliff at the threshold. The 20px floor is never reached (m1).
- **Badge at the vertical centre**: keep it. Question boxes are now stretched to the row height with their text centred, so the centre is where the text is. Aligning to the first line would only look different for multi-line questions.
- **aria "質問 N"**: fine for now. Add a `stepWord` equivalent only if someone asks for it.
- **The example triggers the info**: leave the example as it is. The info is true there: its `sub` fits on one line, so width does not change its height. Make the message actionable (m3) rather than suppressing it.
- **How much more is achievable**: about 14.2pt (title-only slide) for this shape, at the one-line width (about 820–860). Beyond that, the labels fix the 25px gap and the text fixes the row heights (36 / 56). `numbered` costs about 0.4pt at the `fill` width, because the 42px lead widens the question column and the `sub` wraps again at 820–827.
