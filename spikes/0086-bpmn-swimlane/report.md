# U0 spike report: ADR 0086 (bpmn into swimlane)

Branch `spike/0086-bpmn-swimlane` (throwaway, never merged). All example wording generic.
Probes: `spikes/0086-bpmn-swimlane/q1-delegation.ts`, `q3-laneorder.ts`, `q4-bundles.ts`,
`q4b-excludes.ts`. Numbers: `measurements.txt`.

## Verdict: holds with changes (list below)

D6 delegation works end to end: the swimlane definition branches on `arrange: 'auto'`,
calls the moved engine (copied `lib/bpmn.ts` + `lib/bpmn-vertical.ts` with the D6 renames),
returns `LaidOutBpmn`, and serves placed hooks through `outputDefinitions['bpmn']` plus a
kept `FULL_DEFINITIONS['bpmn']`. The internal-layout branch replays `core.ts:256-271`
(`snapGrid(y)`, scope attach, band-id + anchor `ctx.register` with scope, `ctx.y` advance).
Q2 byte identity is exact (0 bytes on all 3 examples, deterministic; PPTX zip entries
identical too). Q3 `laneOrder: 'auto'` reorders an auto figure and the figure verifies
clean. Q4 numbers are recorded for the D10 update.

## Q1 delegation — holds

- 33/33 `test/bpmn.test.ts` pass unmodified through the alias (anchors for `connect()`,
  node ids, reveal, shrink, vertical, error cases).
- Q1 probe: `FULL_DEFINITIONS['bpmn']` kept and pointing at the auto placed-definition;
  `outputDefinitions['bpmn']` wired; `data-node` emitted for task nodes; `via` undescribed
  while `cols: 'auto'` gets `<desc>レーン…手順…</desc>`; one-story matrix (two aliases = no
  warn, timed + `cols: 'auto'` = warn, timed + alias = no warn); raw `{type: 'bpmn'}` data
  throws with the fix-it message.
- Source refs propagate via `layout-core.ts` `markPlacedSource` (uniform for all bands).
- Old `lib/bpmn.ts` / `lib/bpmn-vertical.ts` no longer imported by any production module
  (tests only) and are shaken out of every measured bundle (esbuild metafile).

## Q2 byte identity — holds (0 bytes diff, all 3)

`examples/bpmn.ts`, `bpmn-vertical.ts`, `bpmn-shrink.ts` through the alias path are
byte-identical to committed `examples/out` (rebuild-stable; `examples/out` untouched).

## Q3 laneOrder — holds, keep allowed (no throw fallback needed)

`orderLanes` runs unchanged on auto nodes (reads only id/lane/from/to). `[c,a,b]` +
`laneOrder: 'auto'` reordered to the optimum `[c,b,a]`, byte-equal to the same figure
hand-ordered, control (no `laneOrder`) differs, verdict 0 problems / 0 warns.

## Q4 bundles — measured, budgets must move (see measurements.txt)

- `bands/bpmn.js` (alias): esbuild 138236 (+32194 vs base), Vite 181672 (+39118).
  Bundle bands are now `[box.js, bpmn.js, swimlane.js]` — U1 must update `bands`.
- `bands/swimlane.js` (with auto engine): esbuild 151099 (+56752), Vite 197739 (+78596).
- M5 confirmed live: spec `bpmn` now pulls `swimlane-rules.js` (standalone exclude fails);
  Classes pulls neither engine (excludes would go vacuous without the rename).

## Changes required in U1 (spike findings)

1. `bundle-budget.json` `./browser`: 1085440 -> ~1092000 (spike: 1087416, +5592 net).
   D10 does not mention this budget — add it.
2. `check-package-bundles.ts`: BPMN case `bands: ['box.js', 'bpmn.js', 'swimlane.js']`.
3. Budgets (10% headroom): BPMN 153000/200000, Swimlane 167000/218000 (was 121000/165000,
   101500/130000). Spec `bpmn`/`swimlane` + Selective PPTX Swimlane budgets: re-measure.
4. Spec `bpmn`: move out of standalone (pulls `swimlane-rules.js` now); rename the
   Classes/States `'bpmn.js'` excludes to `layout-swimlane-auto*.js`.
5. `test/source-ref.test.ts`: positional data-type == placed-type assumption must map
   swimlane-auto data to placed `'bpmn'` (test update, inherent to design B).
6. Snapshots/ratchets: public-exports (+2 types), pure-exports (new fns; D11 tests cover),
   rule-locations `bpmn-deprecated` fixture (planned D11(e)).
7. `band-type-literals`: recount — spike nets legend -2 but `describeBands` +1 (suggest a
   `(b: Band) => b is SwimlaneAutoBand` helper so no new literal is needed; m5's 15 may
   actually be 16).
8. Duplicate-anchor message: the internal branch cannot see core's `authored` flag; spike
   uses the authored wording always, so the non-authored message changes. U1: accept, or
   thread `authored` into `LayoutCtx`. No test covers it.
9. Not verified in spike (casts used): `LaneCheck` 8-lane typing (m1, ADR already defers
   to U1), `StepCheck` auto-allowing `kind`, and the `cols: 'auto'` input-type split
   (auto steps take title/body/kind, not `BoxOpts` — U1 must define the input type).
10. `pnpm schema` regen: `config.schema.json` gains `bpmn-deprecated` (test asserts
    checked-in schemas match generated; U2 already plans a regen).

## Pre-existing failures (verified identical on stashed base, not mine)

Font/Chromium metrics (5), tspan/lint `--strict` (2), layout-budget `canvas-seven-s` (1):
all local-font environment issues; `golden-docker.sh` is the arbiter. Full suite with
spike: 4148/4176 pass; the 15 failures are the 8 pre-existing (each re-run on the
stashed base and failing identically) + 7 mechanical U1 updates (source-ref, public-
exports, pure-exports, rule-locations, band-type-literals, schema regen, browser
budget).
