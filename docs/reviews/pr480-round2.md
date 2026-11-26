# PR #480 review (Opus, round 2)

Target: feat/timeline-no-deadline @ 0b2cfba6c5ae903a6651b1218ef7c02d5a11a778

## Conclusion
All round-1 findings are fixed by behaviour (`remaining` / `span` without both ends now throw in the DSL and report at `parts[i].remaining|span` in the spec; the spec message no longer prints `undefined`; README updated). The new short-axis ticks are correct (Mondays, leap day, year wrap, pre-epoch all right; gantt unchanged) and look good on 16:9 slides. But this head is red in CI (the Vite "Spec catalog: timeline" bundle is over budget), and daily / weekly tick labels overlap each other at widths where the same `now` + `deadline` timeline passed `check` before this PR (e.g. a 10-day axis in a 2-column `areas` at the default width 940). converged: no.

## Previous round
- M1 (remaining/span silently dropped): resolved. Ran: `timeline({marks, remaining: 'あと3日'})`, `{marks, span: 'fill'}`, `{now, marks, remaining: 'x'}`, `{deadline, marks, remaining}` all throw "… needs both now and deadline …"; `remaining: false` still accepted; spec gives one issue at `parts[0].remaining` / `parts[0].span`; both-given form validates `[]`.
- m1 (`undefined` in out-of-axis message): resolved. Spec now says `(2026-12 to the last date)` / `(the first date to 2026-11)`.
- m2 (no fine ticks on short axes): implemented; see M2 / m1 below for the new edges.
- n1 (README `marks?`): resolved (README.md:308, and the tick rule is documented at README.md:1015).
- n2 (`schema/spec.schema.json` conflicts): still applies; now #481 and #482 both touch it. Regenerate with `pnpm schema` on conflict.

## Findings
### M1 (Major): CI is red: the Vite "Spec catalog: timeline" bundle is over its 98000-byte budget
- Evidence: CI run 45764532394 on 0b2cfba6, job `test (1/3)`, step `pnpm build && node scripts/check-package-bundles.ts` fails (shards 2/3 and 3/3 were still pending). Reproduced locally: `AssertionError: Vite: Spec catalog: timeline が 98000 バイトを超えています (98794)` (`scripts/check-package-bundles.ts:1229`). Round 1 ran the same check at f235e067 with exit 0, so this commit's additions (the spec `needs both now and deadline` check in `lib/spec-parts/r3-common.ts` and the fine-tick branch in `lib/calendar-axis.ts`) pushed it over by ~800 bytes.
- Fix: trim the added code/messages (e.g. a shorter spec message, or one shared helper) until the catalog is under 98000; raising the budget needs the owner's OK as with ADR 0080 budgets.

### M2 (Major): daily / weekly tick labels overlap each other at moderate widths, so figures that passed before now fail `check`
- Evidence (ran, `checkDiagram`): `timeline({from: '2026-12-01', to: '2026-12-11', now: {at: '2026-12-02'}, deadline: {at: '2026-12-09', label: '締切'}})` (valid before this PR: both ends were required then) inside `areas('a b', {a: <timeline>, b: box({title: 'x'})})` at the default width 940: base 3d48d63f `ok: true`; this head `ok: false`, "label "12/10" overlaps label "12/11" by 1x18px". `areas('a b c', …)` fails at both 940 and 1280 (base passes both). A plain diagram at width 400 with a 10-day axis fails (`12/10` ~ `12/11`); at 320 every adjacent daily pair overlaps, and a 60-day weekly axis has 7 overlaps. `check` does catch it (not silent), but the author has no tick option to fall back on; only widening the figure or the axis helps. Cause: `layoutTimeline` (lib/timeline.ts, the `placed` loop) only drops a clashing label when it was `moved` by the full deadline line; ticks from `ticksOf(…, true)` are emitted without regard to the plot width. 16:9 slides (1280 single figure) are fine: daily, 11-day, year-wrap and full-line + remaining PNGs are all clean.
- Fix: choose the fine step by fit: from the plot width and the widest `m/d` label, step down daily → every 2/3 days → Mondays → months until labels (plus 6px gap) fit; or at least drop (keep the tick, hide the label) any non-moved label that clashes with the previous one. Add a narrow-width test (e.g. 10-day axis at width 400 and in a 2-column `areas` at 940 must pass `check`).

### m1 (Minor): 11–13-day axes get only one or two weekly ticks
- Evidence (ran `ticksOf(…, true)`): 2026-12-01..12-11 (10 days) gives 11 daily ticks; 2026-12-01..12-12 (11 days) gives a single `12/7`. Two marks 5 days apart (axis = 5 + 2×3 padding = 11 days) draw only `11/30` and `12/7`: the orphan-tick look that round-1 m2 was about, just shifted.
- Fix: raise the daily threshold to ~14 days (or let the fit rule in M2 decide).

### m2 (Minor): the 2-month boundary is not pinned by tests
- Evidence (mutation, not committed): `to - from < 61` → `< 31` leaves `test/timeline-no-deadline.test.ts` 12/12 green. (`<= 10` → `<= 5` fails 2, the Monday offset 4 → 3 fails 1, `< 61` → `< 400` fails 1, so those are covered.)
- Fix: assert `ticksOf` at exactly 10 / 11 and 60 / 61 days (daily vs weekly, weekly vs months).

### n1 (nit): `m/d` labels across a year boundary carry no year
- Evidence: 2026-12-20..2027-01-20 gives `12/21 12/28 1/4 1/11 1/18`. Readable because each flag shows its full date, but the axis alone does not say which year.
- Fix (optional): label the first tick of a new year `2027/1/4`.

## Checked and fine
- Mondays: every weekly tick is a Monday for 2026-11..12 and for 1969 (pre-epoch, negative day numbers; `((day % 7) + 7) % 7` handles it). Leap day 2028-02-29 appears in a daily axis. Date math is UTC day numbers, so no DST effect.
- Boundaries: 10 days daily (11 ticks), 60 days weekly (9 ticks), 61 days months (`2026/11 2026/12 2027`).
- Gantt: calls `ticksOf(from, to)` without `fine`; a 40-day gantt range still gets month ticks; gantt tests pass.
- Flags vs ticks: flags sit above the axis and tick labels below, so they never meet; tick labels stay inside the figure; with `deadline.line: 'full'` the moved-label rule still works (16:9 render with remaining bracket is clean).
- Local: targeted tests (timeline*, gantt*, spec-r3) 73/73 pass. CI golden passes.

## Verdict
converged: no (Blocker 0 / Major 2 / Minor 2 / nit 1)
