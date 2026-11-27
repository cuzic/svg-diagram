# PR #490 review (Opus, round 2)

Target: fix/steps-numbered-wrap @ 6fa52ce7783c29fd0833436584cc262fd42a6743

## Conclusion
The round-1 fixes work. In `steps` rows without icons, all badges now sit beside the titles or all sit above them. Plain `box({step})` gives byte-identical SVG to main. The user's case (5 numbered steps, 3 to 7 character Japanese titles, deck widths 620 to 940) no longer breaks titles into 1-character pieces unless the same title would break that way unnumbered. The html bands bundle is within budget, and the PPTX badges match the SVG. One gap is left: the per-row decision skips boxes with an icon. So a DSL `steps()` row where some items have an icon still mixes beside and above, and its title baselines are 38px apart. converged: no.

## Previous round
- M1 (mixed rows): resolved for rows without icons, not resolved for rows where some items have an icon (see M1 below). I reran the round-1 sweeps (294 `renderDeckFigure` `steps` cases plus 144 DSL `box({step})` cases): 0 mixed rows, 0 new `verdict.problems`, 0 badge/title overlaps.
- M2 (html bands budget): resolved. CI run 45805447924 `test (1/3)` passes, and the log shows `Vite: ./html/bands: 100623 bytes` (budget 101000).
- m1 (threshold too wide): resolved. The test is now `<= 1`. `SHORT` at 700px (clean `見積/作成` breaks) keeps the badges beside, and changing the test back to `<= 2` fails test 4.
- m2 (tests): mostly resolved. Removing the alone-vs-beside guard fails a test, making the choice per box fails test 3, and test 7 checks the PPTX badge against `tIns`. The icon guards are still untested (see M1).
- n1 (very narrow boxes still fragment): unchanged. This is not a regression and needs no change in this PR.

## Findings
### M1 (Major): a `steps()` row where only some items have an icon still mixes badge positions, and the icon boxes still break into 1-character pieces
- Evidence (ran): `layoutRow` puts the badge above for every `stepRow` child except one with an icon (`if (!above || !stepRow || (child as BoxBand).icon) return ctx.placeBoxLike(child, ...)`, lib/layout-row.ts), and `badgeAbove` returns false for icon boxes. I swept DSL `steps(titles.map(... i === k ? {icon: 'shield'} : {}), {numbered: true})` over widths 620 to 940 (step 40), with one item given an icon, which matches the shape of the documented example (`{title: '遮断', icon: 'shield'}` among plain items). 48 of 162 rows are mixed. Example: `['下見','見積作成','契約手続','発注準備','納品確認']` at width 620 with the icon on step 2 gives `A:下見@87 | b:見/積/作/成@49 | A:契約手続@87 | A:発注準備@87 | A:納品確認@87`. Two things go wrong. The title baselines differ by 38px. And step 2 keeps the 1-character break this PR exists to remove. Test 5 covers only rows where every item has an icon, so removing either icon guard (in `badgeAbove` or in the `map`) still leaves 7/7 passing. The deck spec `steps` part has no `icon`, so the deck path is not affected.
- Fix: in a row that goes above, give the icon boxes the badge above too, with the left icon shifted down by the same amount. If that is not wanted, exclude any row that contains an icon box from going above, so the row stays uniform. Either way, add a test for a row where only some items have an icon.

## Other checks (no finding)
- Plain `box({step})` is unchanged. 270 DSL cases (row with connects, row with arrows, group, grid, tag on solid boxes, standalone boxes; JA/mixed/EN titles; widths 360 to 960; left, centre and right alignment) give SVG sha1 values identical to main at 8a3a246c. In the spec sweep, the `row`/`single` `box({step})` cases have unchanged boxes and SVG length.
- User's case: a sweep over 12 sets of 5 titles (3 to 7 characters, from a pool of real step names), widths 620 to 940 (step 20), with and without body (408 renders). Main has 200 renders with a 1-character piece; the PR has 32. All 32 are `運用引継/ぎ` at 620 to 680px, and the same 32 appear with `numbered: false`. 0 mixed rows, 0 problems.
- `steps` inside `group()` also goes through `layoutRow` and gets the row-uniform placement (checked at widths 620 to 860).
- PPTX (`renderPptxEdge`, SHORT and MIXED, widths 620/700/940, with body): each badge ellipse offset and radius equal the SVG `stepBadgeAt` values, both for badges above (20,16,r15; `tIns` 52.2px) and badges beside (20,10,r15).
- The internal `stepRow` flag does not reach the SVG. `stepWord` changes only the aria label, so the geometry of a badge above is unchanged.
- No other open PR touches `lib/layout-row.ts`, `lib/steps.ts`, `lib/layout-text.ts`, `lib/layout-box-like.ts` or `lib/box-step-geometry.ts`. CI is all green (golden, test 1/3, 2/3, 3/3).

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 0 / nit 0)
