# PR #471 review (Opus, round 3)

Target: feat/comic-row-layouts @ 7811ee4e266865764afc9f40e8cbd75fb7a307c8

## Conclusion
converged: yes. I checked all three round-2 findings by running them, and each is resolved. A narrow diagram now gives one `comic-band-narrow` problem that names the width needed, and it never draws broken panels. A right-then-left exchange in a row panel is stacked as D2 requires. The narration offset is pinned by a test. A mutation of each fix fails a test. The round-2 changes leave a few narrow edge cases, and I record them as Minor. In each one, `check` either reports a problem anyway (safe-side rejection, or an unhelpful message), or the drawing is off by at most 12px for three people in a panel narrower than 232px. None blocks a merge.

## Previous round
- M1 resolved: `checkDiagram` with 4x1 at widths 480, 900 and 919 gives one `comic-band-narrow` problem with "use diagram({width: 920})". Width 920 is clean, and so are 3x1 at 704 and 2x1 at 488, with the threshold exact to the pixel. Panels are drawn at 200px, and the panels that overflow also get the ordinary "exceeds the canvas" problem. Two heads sit at 40/160. The default `3:4` aspect gives no negative budget (see m3 for explicit aspects). Mutations fail one test each: removing the finding, and putting the clamp back to `Math.max(4, …)`.
- M2 resolved: `left < q.x` holds for rows again (lib/comic/layout.ts:131). In the order `fr` (right) then `me` (left), the reply is placed below: at 280px it is (24,86) under (176,32), and at fontSize 24/28 it is below as well, with no findings for short lines. The ADR note now says D2 also applies to rows. Mutating back to `(!row && left < q.x)` fails the updated test.
- m1 resolved: the narration test asserts an offset of 20 at fontSize 18 and 32 at 28. Mutating `px + m.narrationLeft` to `px + 20` fails it.
- Targeted runs: `test/comic-*.test.ts` 159/159 pass. CI at review time: golden pass, and the three test shards are pending.

## Findings

### m1 (Minor): three people in a row panel 200–228px wide overlap heads by up to 12px, with no finding
- Evidence (ran `layoutComic` with left/center/right on stage): with a 204px panel (`slide: true` 4x1, which the ADR note documents), the heads are at 40/100/164. The gap is -12, so the circles overlap. A 220px panel gives heads at 40/108/180 (gap -4). Panels of 200px (3x1 at w 664, 2x1 at 448) give 40/100/160 (gap -12). `checkDiagram` reports nothing for 4x1 at width 940 or for `slide: true`. `ROW_PANEL_MIN` (200) is sized for two heads. The `HEAD_R + 4` floor on stageX applies below 232px. The ADR note's "3 人の頭の円の間は 4px 空く" holds only at 232px and above. This existed before round 2 at `slide: true`. The round-2 fix made it the floor case.
- Fix: when a row panel puts someone at `center` and `PW < 232`, raise one comic problem (or a `comic-band-narrow` variant) that says to use two people, fewer columns or a wider diagram. Alternatively, state the 232px limit in the ADR note. Do not raise `ROW_PANEL_MIN` to 232, because that would make `slide: true` 4x1 narrow.

### m2 (Minor): a stacked two-speaker pair still wraps at half width, so the right-then-left order is rejected where left-then-right is accepted
- Evidence (ran): `twoSpeakers` picks the `sideBySide` cap no matter what order they speak in (layout.ts:113, 120). Now that D2 stacks a right-then-left exchange, both bubbles keep the half-width wrap even though they no longer share a line. At 200px panels (4x1, w=856) and fontSize 18, the order `今日は雨だね。` then `そうだね。` has no findings with the first speaker on the left. With the first speaker on the right, it gives `comic-bubble-zone` and `comic-text-budget`. Both are reported, so this is a safe-side rejection, but the same dialogue fails only because of who speaks first.
- Fix: use the `alone` cap for a bubble that D2 will stack anyway, that is, when an earlier bubble in the panel belongs to a speaker standing to its right. Or document that the right-then-left order costs lines.

### m3 (Minor): an explicit short aspect in a row gives zero or negative line budgets and a message that cannot be acted on
- Evidence (ran): one line `はい。` in a row panel. At 280px with `aspect: '7:5'` (documented as allowed in rows), fontSize 18 gives "1 lines are stacked in p1 (at most 0); shorten the lines". At fontSize 28 it gives "at most -1 lines in all". At 200px, `7:5` gives "at most -2" and `6:5` gives "at most -1". The round-2 narrow test asserts that no message has a negative number, but only for the default `3:4`. Every case is reported as a problem, so nothing is drawn wrong silently.
- Fix: when `lineBudget` is below 1 in a row panel, report once that the aspect is too short for this panel width and fontSize (name `3:4`), instead of "shorten the lines". Or limit the row aspects to `3:4` / `1:1`.

### nit1: `comic-band-narrow` is missing from ADR 0074's rule table, and its message hard-codes a 40px diagram padding
- Evidence (read): the 検査 table (docs/adr/0074-comic-worksheet-parts.md:257ff) does not list the new rule. The message adds `+ 40` to `bandWidth` (layout.ts:72). That matches `diagram({width})` today, because I measured the band at `width − 40`, but it can drift if the padding changes or when the band is placed in a narrower container.
- Fix: add the row to the table, and derive the suggested width from the band's `w` and the diagram width (needed = width + (bandWidth − w)), not from a constant.

## Notes
- Open PR #473 (chat U5) still touches `lib/comic/{reserve,emit,layout}.ts`, the README and ADR 0074, as recorded in round 2. Whichever PR merges second must reconcile the `templateAtoms` / `reserveAtoms` signatures.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 3 / nit 1)
