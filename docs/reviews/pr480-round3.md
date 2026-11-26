# PR #480 review (Opus, round 3)

Target: feat/timeline-no-deadline @ bec2d4e5fca58e81ddf4de220542703a252b47e5

## Conclusion
All round-2 findings are fixed by behaviour. Short axes now pick the finest day-level tick set whose labels fit, and fall back to month ticks. The round-2 overlap cases pass `check`. The only Vite budget raised is "Spec catalog: timeline" (98000 to 100000, measured 99064). `./browser` is untouched. One narrow case is left: a tick at the axis end that starts a new year (`2027/1/x`) can still overlap its neighbour. Owner rule: narrow cases are Minor. converged: yes.

## Previous round
- M1 (Vite timeline catalog over budget): resolved. The diff to `scripts/check-package-bundles.ts` changes one line, `timeline` Vite 98000 to 100000. Ran `pnpm build && node scripts/check-package-bundles.ts` locally: Vite timeline 99064, esbuild timeline 75953 (budget 76000 unchanged, only 47 bytes of headroom). `./browser` budgets are not in the diff. The commit message gives the reason.
- M2 (daily/weekly labels overlap at moderate widths): resolved for the reported cases. Ran `checkDiagram`. The round-2 cases now pass: the 10-day `now`+`deadline` axis in `areas('a b')` at 940, `areas('a b c')` at 940 and 1280, and width 400. They are pinned in `test/timeline-no-deadline.test.ts`. A sweep over widths 300–1300 (step 20), axis lengths 1–70 days and 3 start dates (21420 figures) leaves only the year-boundary case in m1 below.
- m1 (11–13-day axes got 1–2 weekly ticks): resolved. At 1280, an 11-day axis (two marks 5 days apart) draws 12 daily ticks, and a 12-day axis draws 13.
- m2 (2-month cutoff untested): resolved. `fineTickSets(0, 60)` gives sets of sizes `[9, 5]`, and `fineTickSets(0, 61)` gives `[]`. Both are asserted. The `>= 61` boundary can no longer move unnoticed.
- n1 (no year on `m/d` ticks across a year): resolved. 2026-12-20..2027-01-20 at 1280 gives `… 12/31 2027/1/2 1/4 …`. Checked with negative day numbers (pre-1970): the Monday sets still fall on Mondays.

## Findings
### m1 (Minor): an axis-end tick labelled with the new year can overlap its neighbour, failing `check` where the base passed
- Evidence (ran, `checkDiagram`, single timeline, `legend: false`): `timeline({from: '2026-12-21', to: '2027-01-02', now: {at: '2026-12-21'}, deadline: {at: '2026-12-27', label: '締切', line: 'full'}})` at width 400 fails with `label "12/31" overlaps label "2027/1/2" by 8x18px`. The same figure passes on base 3d48d63f, which drew month ticks. The same failure shows at 420/440 for this axis, at 680–760 for 2026-12-21..2027-01-01, and at 340/360 for 2026-12-01..2027-01-04/05: 24 failures in the 21420-figure sweep, all of this kind. Cause (`lib/timeline.ts` `apart`): the fit test places every label centred on its tick, but the loop below clamps a label to stay inside `[x, x + w]`. `plotR` is only 12px inside the figure. A wide `2027/1/x` label on the last tick is pushed left by about 15px, and that is more than the 8px versus 6px slack in `apart`. The first tick has the same clamp, but `m/d` labels are narrow enough not to show it.
- Fix: make `apart` use the clamped `left` (the same `Math.min(Math.max(tx - tw/2, x), x + w - tw)`), and add the 400px 2026-12-21..2027-01-02 case to the test.

### m2 (Minor): README still describes the old fixed thresholds
- Evidence: README.md:1015 says 「軸が 2 か月未満なら月曜ごと、10 日以内なら 1 日ごと」. The code now picks by fit among 1 day, 2 days, Monday and every other Monday (16 ticks at most), falls back to month ticks, and puts the year on the first tick of a new year.
- Fix: reword that sentence to describe the fit rule and the year label.

### n1 (nit): the spec message for an empty timeline lost its example
- Evidence: `lib/spec-parts/r3-common.ts` now says `needs at least one of now, deadline or marks`. Before, it showed `now ({at: '2026-10'})` and `deadline ({at: …, label: …})`. It was shortened to save bundle bytes. It still says what to add, but not how to write it.
- Fix (optional): none needed while the budget is tight.

## Checked and fine
- Numeric timelines (`unit`) take their own path (`numericTexts` / `numericTicks`) and never call `fineTickSets`.
- `timelineTexts` registers the labels of every candidate set plus the month ticks, so every label the layout may pick is measured.
- Moved labels (with `deadline.line: 'full'`) still follow the round-1 rule. In the sweep, `full` and plain figures failed only in the same year-boundary cases.
- An axis that starts in January (2027-01-02..01-10) has no year on any tick. This matches "first tick of a new year" as specified, and the flags show full dates.
- Local: `node --test test/timeline*.test.ts test/gantt*.test.ts test/spec-r3.test.ts` 75/75 pass. CI on bec2d4e5 is all green (golden, test 1/3 including the bundle check, 2/3, 3/3).
- Other open PRs: #374 (gantt) and #372 (pptx) do not touch `lib/calendar-axis.ts`, `lib/timeline.ts` or the timeline budget line. No overlap was found beyond the `schema/spec.schema.json` note from round 2.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 2 / nit 1)
