# PR #501 review (Opus, round 1)

Target: fix/swimlane-backflow-label @ 514999bc

## Conclusion
The original case is fixed: one labelled back-flow past a box in a single-row lane now runs under the boxes, its chip stays inside the lane, and lanes without a labelled back-flow do not grow. Every back-flow takes the same depth, though, and the route only looks at its two end boxes. Several inputs that people will write still give wrong figures: two back-flows in one lane, a taller box in between, a lane with rows, or a hand-over that leaves from the bottom of the same box. A swimlane flow cannot take `dip`, so the user has no way to fix any of these. Each back-flow also adds blank space below the whole swimlane. converged: no.

## Previous round
- (first round)

## Findings

### M1 (Major): every back-flow in a lane takes the same depth, so nested or overlapping back-flows draw on one line and their labels can sit on each other
- Evidence: I ran these cases in one lane with five steps `s1`..`s5`, chained forward. With `s5 -> s1:bottom` labelled "Redo all" and `s4 -> s2:bottom` labelled "Fix", both horizontal legs are at y=137. The two chips are `[500,125,69,24]` and `[517,125,35,24]`, so one covers the other completely. With `s4 -> s1` and `s5 -> s2` (no sides, partly overlapping spans), both run at y=137 and one line covers the other from x=380 to 688. `check` reports no problems. It only gives an `edge-crossings` warn, and the fix it suggests is "write dip on the outer one". `SwimlaneFlow` (lib/types/sequence-table-swimlane.ts:151) has no `dip`, so that fix cannot be written. Label-on-label overlap is not reported at all. The cause is the fixed depth at lib/dsl/swimlane.ts:144 (`dip: f.label ? 12 : 8` for every flow).
- Fix: give each under-flow of a lane its own depth (nested: the outer one deeper; for spans that only partly overlap, keep distinct depths too). Size `underRoom` in lib/layout-swimlane.ts from the deepest one, as lib/loop-back-connectors.ts already does with `DIP + lane * LANE`.

### M2 (Major): each back-flow adds 16 px (no label) or 36 px (with a label) of blank space below the whole swimlane, and this adds up
- Evidence: I added a `box` after the swimlane. The gap between the bottom of the swimlane frame and the next box is 18 px with no back-flow. It is 34 px with one unlabelled back-flow, 54 px with one labelled, 90 px with two and 126 px with three. The canvas height goes from 227 to 279 px with one labelled back-flow. `check` passes. The cause is lib/layout-connect.ts:320-323: a loop-under connect sets `ctx.y = max(from.y, to.y, ctx.y) + dip + labelClearance`. After a swimlane, `ctx.y` is already the frame bottom plus the gap, so the dip and the clearance are added below the frame, on top of the 16 px `underRoom` the lane already got. This happens wherever the lane is, the top lane included.
- Fix: the swimlane already makes room inside the lane, so its under-flows should not reserve space in `layoutConnect`. Mark them (for example with an internal flag) and skip that branch, or reserve only up to the frame bottom. Add a test that the next band's y does not change when a back-flow is added.

### M3 (Major): the depth is measured from the two end boxes, not from the boxes in between, so a taller box in between is crossed by the line and the label
- Evidence: three steps in one lane. The middle step has a long title that wraps to 104 px high, and the end steps are 41 px. With `s3 -> s1:bottom` the line runs at y=165, but the middle box reaches y=188. `check` reports `path overlaps "<middle>" by 229x6px`. With a label, it also reports `label "Redo" overlaps "<middle>" by 50x24px`. Steps are centred in `maxStep` (lib/layout-swimlane.ts:88), so a short end box has its bottom above the bottom of a tall box in between. lib/layout-connect.ts:83 takes `midY = max(from.y, to.y) + dip`. This is the case B1 is meant to fix (a line through the middle box, and its label on it), with taller boxes. The user cannot fix it: there is no `dip` to give, and side anchors bring back the old route.
- Fix: in swimlane, measure the depth from the bottom of the lane's step block (`blockTop + maxStep` of that row). For example, pass a dip computed after layout, or anchor the leg to the lane instead of to the end boxes.

### M4 (Major): in a lane with rows, a labelled back-flow in row 0 runs into the row-1 boxes, and the extra room goes under the last row
- Evidence: five steps in row 0 of lane `b`, and one step in row 1 at col 3. With `s5 -> s2:bottom` labelled, the line is at y=137 and the row-1 box starts at y=136. `check` reports `path overlaps "<row-1 step>" by 126x4px` and `label "Redo" overlaps "<row-1 step>" by 11x13px`. `rowGap` is 12 (lib/layout-swimlane.ts:56), the labelled dip is 12, and the chip is 24 px high. `underRoom` adds its 16 px at the bottom of the lane (`h = core + 16`), below row 1, where it does not help. The unlabelled case only just clears: the line is at y=133, 3 px above the row-1 box.
- Fix: run the back-flow from a row other than the last only when the gap below that row can take it: widen that row's gap, or route it under the lane's last row. Otherwise keep the old route and report it. Add a test with a two-row lane.

### M5 (Major): a back-flow and another flow that use the same box's bottom share one point, and nothing reports it
- Evidence: lanes `a`, `b`, `c`. `s5 -> s2:bottom` labelled "Redo", and a hand-over `s2 -> c2` (c2 in lane `c`, same column) labelled "Hand over". Both lines use (380,125): the hand-over goes down from it, and the back-flow comes up into it. The hand-over chip `[338,130,83,24]` sits on the back-flow's horizontal leg at y=137 and on its arrowhead. The same happens at the start: with `s5 -> c1` going down from s5, the back-flow leaves from the same point (843,145). `check` reports nothing. `edgeStats` skips pairs that share an end id (lib/verify-connect-crossings.ts:39), and the under-flows are not counted in `spread()`, because `note()` only counts `auto` flows (lib/dsl/swimlane.ts:134).
- Fix: count the `:bottom` ends of under-flows in `uses`, so that `spread()` moves both lines along the side, and spread the under-flow ends too.

### m1 (Minor): the tests do not prove three of the claims (the mutations survive)
- Evidence: these mutations, each applied alone, leave all 3 tests in test/swimlane-backflow.test.ts passing:
  1. `underRoom` for every under-flow, labelled or not (`sp.under && sp.f.label` → `sp.under`): no test checks that a lane does not grow without a label.
  2. The `row` check dropped from `sameRow`: no test has rows.
  3. `(!fside || fside === 'bottom')` → `true`: no test checks that an explicit `from: 'x:right'` keeps the user's side.

  The mutations that do fail tests: `blocked` always true or always false, labelled dip 8, `UNDER_ROOM = 0`, `blockTop` taken from `h`, and no default chip.
- Fix: add one test each: an unlabelled back-flow leaves the lane height unchanged, a two-row lane (this also covers M4), and an explicit start side stays elbow.

### m2 (Minor): the new behaviour is not documented where users and the MCP read it, and some options are silently dropped
- Evidence: the header comment of lib/dsl/swimlane.ts (lines 18-20) and the `swimlane` part description (lib/spec-parts/swimlane.ts:8) still say only "right->left across columns". They do not say that `to: 'id:bottom'` on a way back, or a way back past a box, now runs under the boxes. `bend` and `bendOffset` on such a flow are dropped without a message (line 144 does not pass them).
- Fix: add one sentence to both. Either throw on `bend` / `bendOffset` for a flow that runs under, or say in the docs that they are ignored.

### n1 (nit): the cycle hint can be read more than one way
- Evidence: "In a wide place, steps with loopBack reads better than a ring." `steps` is the part name, but it reads as a plural noun with a singular verb. "A wide place" is vague.
- Fix: "When the figure is wide, a `steps` part with `loopBack` reads better than a ring."

## Other checks
- PPTX: lib/pptx is unchanged. The new route exports through `fitConnector` as a glued `bentConnector3` (`rot=5400000`, `adj1=900000` for dip 12). This is the same form an existing `connect({route: 'loop-under'})` gets. `evalConnector` draws it back within 1.3 px (the error comes from `MIN_EXT`, since both ends are at the same y). It is not a freeform, so the free-line.ts change from #499 is not involved. The slide XML is the same kind as the outputs the `ooxml-xsd` CI job validates. I did not validate it with xmllint locally (xmllint is not installed here).
- pptx-golden and the SVG golden: the only swimlane example (examples/service-blueprint.ts) has no back-flow, so neither changes. The CI `golden (examples/out)` job passed.
- Cases that work: phases, the last lane (the label ends at y=149 and the lane at 154), the lane above another lane (the line stays in its own lane, at 89 in a lane that ends at 105), a step with `span: 2` as the target, and an adjacent way back (`q -> p`, which stays elbow). A label wider than the span covers both legs and the arrowhead, and `connect-label-covers-arrow` warns about it.
- A back-flow across rows (`row 1 -> row 0:bottom`) stays elbow. Its last leg runs along the target's bottom edge for about 114 px. That is the old elbow code path, which this PR does not change.
- CI run 45942707750 is all green. The PR merges cleanly with origin/main. Of the other open PRs, only #372 is in the same area (pptx tables), and it touches none of these files.

## Verdict
converged: no (Blocker 0 / Major 5 / Minor 2 / nit 1)
