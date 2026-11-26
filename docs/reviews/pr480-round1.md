# PR #480 review (Opus, round 1)

Target: feat/timeline-no-deadline @ f235e06789450cf07754c60c9553894b74421d0f

## Conclusion
The core change is sound: a date `timeline` with only `marks` (or only `now` / only `deadline`) builds, validates as a spec, renders through `renderDeck` on a 1280x720 slide, and the both-given form is unchanged (CI golden passes, no golden moved). The user's case (a few near-future points, no deadline) draws legibly in both the date form and the documented numeric day-offset form. One Major remains: `remaining` and `span` are now silently dropped when `now` or `deadline` is missing, with `check` and `validateSpec` both passing. converged: no.

## Previous round
First round; nothing to carry over.

## Findings
### M1 (Major): `remaining` and `span` are silently ignored unless both `now` and `deadline` are given
- Evidence (ran): `timeline({marks: M, remaining: 'あと3日'})` and `timeline({marks: M, span: 'fill'})` both give `verdict.ok = true`, no span, no bracket, and the written text never appears. The same with only `now` plus `remaining: 'x'`. `validateSpec({type: 'timeline', marks: M, remaining: 'x'})` returns `[]`. Before this PR the case could not happen (both were required). Now an author's text vanishes while `check` passes. `lib/timeline.ts` `remainingLabel` (`!band.now || !band.deadline ... ? ''`) and the `if (band.now && band.deadline)` span guard drop them. `lib/dsl/timeline.ts` and `checkTimeline` never reject them.
- Fix: throw in `buildTimeline` (and push a spec issue at `${at}.remaining` / `${at}.span`) when `remaining` (other than `false`) or `span` is given without both `now` and `deadline`, e.g. "remaining needs both now and deadline (it is the time between them)". Add one assert each to `test/timeline-no-deadline.test.ts`.

### m1 (Minor): the spec's out-of-axis message prints `undefined` for an omitted end
- Evidence (ran): `{type: 'timeline', from: '2026-12', marks: [{at: '2026-11-27', ...}]}` gives `2026-11-27 is outside the axis (2026-12 to undefined)`. `to`-only gives `(undefined to 2026-11)`. The DSL already says `the first item` / `the last item` (`lib/dsl/timeline.ts` `axisText`). Source: `lib/spec-parts/r3-common.ts` `onAxis` message.
- Fix: use the same wording as the DSL: "is before from (2026-12)" / "is after to (...)", or `String(part.from ?? 'the first date')`.

### m2 (Minor): with spans under a month (OQ3), the date axis has 0–1 month ticks
- Evidence (rendered via `renderDeck`, 1280x720, resvg PNG): marks on 11-27 / 12-03 / 12-07 / 12-26 draw four flags, each with its full date, and a single `2026/12` tick between the first two. Marks on 11-27 / 11-30 / 12-03 draw the same way. Nothing overlaps and every label is readable, because each flag carries its own date. But the lone month tick looks like an orphan label, and the axis gives no sense of a week's length. The numeric form (`unit: '日', from: 0, to: 32`) draws `0日 … 30日` ticks every 5 days and reads better for "明日 / 1週間後 / 来週 / 1か月後".
- Fix (follow-up, not this PR): in `ticksOf`, below about 2 months use weekly ticks (`12/7`); below about 10 days use daily ticks. The labels need no extra explanation.

### n1 (nit): README table shows `marks` without `?`
- Evidence: `README.md` table row `timeline({from?, to?, now?, deadline?, marks, remaining})`. `marks` is optional too (only one of now / deadline / marks is needed).
- Fix: `marks?`, `remaining?`.

### n2 (nit): `schema/spec.schema.json` is also touched by open PR #481
- Evidence: `gh pr list`. #481 (decisionLadder spec) regenerates the same file, along with README and `auto-layout.md`. Whichever PR merges second will get textual conflicts there.
- Fix: on conflict, regenerate with `pnpm schema` instead of hand-merging.

### Checked and fine
- Single mark: axis ±3 days, flag centred, clean. Three marks on the same date merge into one flag `試作・確認・公開`. `now` and `deadline` on the same day work as before. Four labels in three consecutive days plus one a year later throw a clear "labels near … do not fit" error (loud, not silent). `from` after every mark, or `to` before every mark, throws `outside the axis`. `now: null` / `now: '2026-11'` throw `must be {at: ...}`.
- Padding: `max(3 days, 8% of span)` keeps the end flags off the axis ends (single, month-only and year-only marks all checked). The omitted end is always derived from the items, so with one end given the axis cannot invert.
- Spec: `required` is now `['type']` for both forms, but the numeric form still reports a missing `from` / `to` (`must be a number, as the other end is`). `{type: 'timeline'}` and `marks: []` report at `marks`. The English build no longer assumes `now` / `deadline`.
- Renderers: `emit-timeline.ts` and `pptx/timeline.ts` already treat `span` / `bracket` as optional. No other consumer reads `band.now` / `band.deadline`.
- Mutations: removing the DSL "no items" throw fails 2 tests, and removing the spec "needs at least one date" issue fails `spec-r3`. Not committed.
- Local: `pnpm typecheck` and `pnpm lint` (no errors) pass. `pnpm build && node scripts/check-package-bundles.ts` exits 0 (bundle budget OK; this was not run by the author). Targeted timeline / spec-r3 tests: 51/51. Full `pnpm test`: 3993 pass, 8 fail (emoji ×2, Chromium atoms ×2, Japanese system font, `layout-budget` on `canvas-seven-s`, lint on `image-labels` / `bpmn-*` ×2). None involves timeline or this PR's files; these are this environment's known failures. CI golden passes; CI test shards were still pending at review time.

## Open questions (recommendations)
1. Relative points without dates: agree with not adding a date model. The numeric form with `unit: '日'` already draws the user's slide well. Adding a way to hide the value (`events[].text` or `showValue: false`) is a small, separate follow-up.
2. Padding 8% / min 3 days: fine as is. Nothing collided in the probes.
3. Day/week ticks for short spans: not required in this PR (m2). The drawing is correct and readable. Do it as a follow-up in `ticksOf`.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 2)
