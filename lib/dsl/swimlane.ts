import {MAX_LANES_TO_ORDER, bestLaneOrder} from '../lane-order.ts';
import {resolveIcon} from '../icon-registry.ts';
import {assertSolidText, richBoxFields} from '../rich.ts';
import type {ConnectBand} from '../types/containers.ts';
import type {SwimlaneBand, SwimlaneLane, SwimlaneOpts, SwimlaneStep, SwimlaneStepBand} from '../types/sequence-table-swimlane.ts';
import type {AnchorsOf, Declares, FlowCheck, FlowIn, LaneCheck, StepCheck, StepIds, SwimlaneStepIn} from '../strict.ts';
import {must} from '../must.ts';
import {connectBand} from './defaults.ts';
import {graphTones, litLink, resolveFocus} from '../focus.ts';
import {assertBoxTone, assertFontSize, revealOf, scopeOpt, withAnchors} from './shared.ts';

// Swimlane diagram: who does what, in what order, and where the hand-offs are.
//   lanes: [{id, label, tone?, fixed?}]  (fixed: svg-diagram check never suggests moving this lane)  — horizontal bands, top to bottom (an actor, a team, a system)
//   steps: [{id, lane, title, body?, col?, span?, row?, tone?, tag?, ...any box() field}]
//          Columns are time. Listed in order, each step takes the column after the previous one;
//          give `col` to line up work that happens in parallel in different lanes.
//          `row` (0, 1, ...) stacks overlapping work of the SAME lane into sub-rows.
//   opts.flows:  [{from, to, label?, chip?, line?, arrow?, bend?}]  — step ids, or 'id:side[@t]' to choose the side.
//                Sides are picked from the lanes/columns: right->left across columns (the vertical leg sits
//                just before the target, so it never crosses a box in between), bottom<->top within a column.
//                A way back along ONE lane (same lane and row, to an earlier column) that ends on 'id:bottom' (the start side left out or ':bottom'), or that has no sides
//                and passes a box in between, runs UNDER the row's boxes (route 'loop-under'): the lane grows for the line and its label, and ways back that overlap
//                or nest each run at a depth of their own (the outer one deeper). An explicit start side other than bottom, or `bend` / `bendOffset`, keeps the elbow.
//   opts.phases: [{label, from, to}]  — column groups named across the top (a stage, a sprint)
//   opts.boundaries: [{after: laneId, label?} | {between: [laneId, laneId], label?}]  — a heavy dashed line across that lane boundary, named in a chip on the
//                label column (a service blueprint's line of interaction / of visibility / of internal interaction). `between` throws when the two
//                lanes are not next to each other, and is the form to use with laneOrder.
//   opts.labelW: width of the lane-label column (default 128; 'fit' = the longest lane name on one line, the default on a canvas diagram)
//   opts.laneOrder: 'auto' puts the lanes in the order that makes the hand-offs (opts.flows) shortest; `fixed: true` lanes stay put (lib/lane-order.ts)
// Returns an array (the lane block followed by its flows); d.add() accepts it directly.
//
// Types: at most 6 lanes (rule swimlane-lanes); every step.lane is a declared lane id; step ids are unique; flows'
// from / to are step ids (optionally ':side[@t]'); chip / labelAt need a label. The step ids are exposed to add().
/** focus on a swimlane: the steps' tones (solid / accent / muted) and the flows' (lit: accent, the rest muted). A flow end may be 'id:side@t'. */
function focusSwimlane(steps: SwimlaneStep[], opts: SwimlaneOpts): {steps: SwimlaneStep[]; opts: SwimlaneOpts} {
  const ids = steps.map(s => s.id), hit = resolveFocus(must(opts.focus), ids, 'swimlane()');
  const at = (end: string): number => ids.indexOf(must(end.split(':')[0]));
  const flows = opts.flows ?? [];
  const tones = graphTones(ids.length, flows.map(f => [at(f.from), at(f.to)] as const), hit);
  return {
    // a focused step is filled: its own text tones would not show on the fill (and would be refused), so they give way to the white text
    steps: steps.map((s, i) => {
      if (tones[i] !== 'solid') return {...s, tone: must(tones[i])};
      const {titleTone: _t, bodyTone: _b, iconTone: _i, ...rest} = s as SwimlaneStep & {titleTone?: unknown; bodyTone?: unknown; iconTone?: unknown};
      return {...rest, tone: 'solid' as const} as SwimlaneStep;
    }),
    opts: {...opts, flows: flows.map(f => ({...f, tone: litLink(at(f.from), at(f.to), hit) ? 'accent' as const : 'muted' as const}))},
  };
}
// the ways back under a lane's boxes: the first runs UNDER_FIRST (UNDER_FIRST_LABELLED when one in its row has a label, so the chip clears the boxes) below the row's lowest box,
// the next ones UNDER_STEP (UNDER_STEP_LABELLED) deeper each; the chip is 24px high, half of it below its line
const UNDER_FIRST = 8, UNDER_FIRST_LABELLED = 14, UNDER_STEP = 10, UNDER_STEP_LABELLED = 28, UNDER_CHIP_HALF = 12, UNDER_MARGIN = 6;
const underOffset = (labelled: boolean, level: number): number => (labelled ? UNDER_FIRST_LABELLED + level * UNDER_STEP_LABELLED : UNDER_FIRST + level * UNDER_STEP);
export function swimlane<
  const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [], const Id extends string = never,
>(lanes: L & LaneCheck<L>, steps: S & StepCheck<L, S>, opts?: Omit<SwimlaneOpts, 'flows' | 'id'> & {id?: Id; flows?: F & FlowCheck<StepIds<S>, F>}): (SwimlaneBand & Declares<StepIds<S> | Id> | ConnectBand)[] & AnchorsOf<StepIds<S> | Id>;
export function swimlane(lanesIn: SwimlaneLane[], stepsIn: SwimlaneStep[], optsIn: SwimlaneOpts = {}): (SwimlaneBand | ConnectBand)[] {
  const {steps, opts} = optsIn.focus === undefined ? {steps: stepsIn, opts: optsIn} : focusSwimlane(stepsIn, optsIn);
  if (optsIn.focus !== undefined) {
    try { return swimlaneOf(lanesIn, steps, opts); } catch (e) {
      // what is left to refuse on a focused step is a coloured span of its text: say that focus made it solid
      throw e instanceof Error && /tone 'solid'/.test(e.message) ? new Error(`swimlane(): focus fills the step (tone 'solid', white text): ${e.message}`) : e;
    }
  }
  return swimlaneOf(lanesIn, steps, opts);
}
function swimlaneOf(lanesIn: SwimlaneLane[], steps: SwimlaneStep[], opts: SwimlaneOpts): (SwimlaneBand | ConnectBand)[] {
  if (opts.labelW !== undefined && opts.labelW !== 'fit' && !(typeof opts.labelW === 'number' && Number.isFinite(opts.labelW) && opts.labelW > 0)) throw new Error(`swimlane(): labelW must be a positive number or 'fit' (got ${JSON.stringify(opts.labelW)})`);
  const lanes = opts.laneOrder === undefined ? lanesIn : orderLanes(lanesIn, steps, opts);
  for (const l of lanes) assertBoxTone(l.tone, `swimlane() lane "${l.id}"`);
  let boundaries: {after: string; label?: string}[] | undefined;
  if (opts.boundaries !== undefined) {
    if (!Array.isArray(opts.boundaries)) throw new Error('swimlane(): boundaries must be a list, e.g. [{after: \'cust\', label: \'相互作用線\'}]');
    const seenB = new Set<string>();
    boundaries = opts.boundaries.map(b => {
      if (b === null || typeof b !== 'object') throw new Error('swimlane(): boundaries: each one is {after: laneId, label?} or {between: [laneId, laneId], label?}');
      if (b.label !== undefined && (typeof b.label !== 'string' || !b.label.trim())) throw new Error('swimlane(): boundaries: a label must be a non-empty string');
      if ((b.after === undefined) === (b.between === undefined)) throw new Error('swimlane(): boundaries: write either `after` or `between` (exactly one)');
      let upper: string;
      if (b.between !== undefined) {
        if (!Array.isArray(b.between) || b.between.length !== 2) throw new Error('swimlane(): boundaries: `between` is two lane ids, e.g. between: [\'cust\', \'front\']');
        const [x, y] = b.between, i = lanes.findIndex(l => l.id === x), j = lanes.findIndex(l => l.id === y);
        if (x === y) throw new Error(`swimlane(): boundaries: between [${x}, ${y}] names the same lane twice`);
        if (i < 0 || j < 0) throw new Error(`swimlane(): boundaries: between [${x}, ${y}]: "${i < 0 ? x : y}" is not a lane id`);
        if (Math.abs(i - j) !== 1) throw new Error(`swimlane(): boundaries: lanes "${x}" and "${y}" are not next to each other${opts.laneOrder !== undefined ? ' (laneOrder moved them apart: put fixed: true on the lanes either side of the boundary, or drop laneOrder)' : ' (a lane was added between them; move the boundary)'}`);
        upper = must(lanes[Math.min(i, j)]).id;
      } else {
        if (opts.laneOrder !== undefined) throw new Error('swimlane(): with laneOrder the lanes move, so write boundaries as {between: [a, b]}, not {after}');
        const at = lanes.findIndex(l => l.id === b.after);
        if (at < 0) throw new Error(`swimlane(): boundaries: "${b.after}" is not a lane id`);
        if (at === lanes.length - 1) throw new Error(`swimlane(): boundaries: "${b.after}" is the last lane, so there is no boundary after it`);
        upper = b.after as string;
      }
      if (seenB.has(upper)) throw new Error(`swimlane(): boundaries: two lines on the boundary after lane "${upper}"`);
      seenB.add(upper);
      return {after: upper, ...(b.label === undefined ? {} : {label: b.label})};
    });
  }
  const laneIdx = new Map(lanes.map((l, i) => [l.id, i]));
  let next = 1, cols = 0;
  const placed = steps.map(st => {
    const rich = richBoxFields(st, 'swimlane() step');
    if (!laneIdx.has(st.lane)) throw new Error(`swimlane(): step "${st.id ?? ('title' in rich ? rich.title : st.title)}" uses unknown lane "${st.lane}"`);
    const span = st.span ?? 1;
    const col = st.col ?? next;
    next = col + span;
    cols = Math.max(cols, col + span - 1);
    if (st.size !== undefined) assertFontSize(st.size);
    const step = {...st, ...rich, type: 'box' as const, col, span} as SwimlaneStepBand;
    assertSolidText(step, 'swimlane() step');
    if (step.icon !== undefined) step.iconGlyph = resolveIcon(step.icon, 'swimlane() step icon');
    if ((step.iconAt !== undefined || step.iconSize !== undefined) && step.icon === undefined) throw new Error('swimlane() step: iconAt / iconSize need an icon');
    return step;
  });
  const byId = new Map(placed.map(st => [st.id, st]));
  // 1) pick sides, 2) spread flows that share a side of one step along that side, 3) stagger the
  // vertical legs that enter the same column so parallel arrows stay distinguishable.
  const specs = (opts.flows ?? []).map(f => {
    const [fid, fside] = String(f.from).split(':'), [tid, tside] = String(f.to).split(':');
    const a = byId.get(fid), b = byId.get(tid);
    if (!a || !b) throw new Error(`swimlane(): flow ${f.from} -> ${f.to} refers to an unknown step id`);
    let from = f.from, to = f.to, auto = false, under = false;
    // a way back along one lane, to the bottom of an earlier step (or past a step in between): run it under the lane's boxes, never through them
    const sameRow = a.lane === b.lane && (a.row ?? 0) === (b.row ?? 0) && a.col > b.col + b.span - 1;
    const blocked = sameRow && placed.some(o => o !== a && o !== b && o.lane === a.lane && (o.row ?? 0) === (a.row ?? 0) && o.col + o.span - 1 > b.col && o.col < a.col);
    // an explicit bend / bendOffset is a request for the elbow: it keeps the old route
    const plain = f.bend === undefined && f.bendOffset === undefined;
    if (plain && (sameRow && tside === 'bottom' && (!fside || fside === 'bottom') || (sameRow && blocked && !fside && !tside))) {
      under = true; from = `${fid}:bottom`; to = `${tid}:bottom`;
    } else if (!fside && !tside) {
      auto = true;
      const la = must(laneIdx.get(a.lane)), lb = must(laneIdx.get(b.lane)); // every step's lane was checked against `laneIdx` above
      if (b.col > a.col + a.span - 1) { from = `${fid}:right`; to = `${tid}:left`; }
      else if (a.col > b.col + b.span - 1) { from = `${fid}:left`; to = `${tid}:right`; }
      else if (lb > la || (lb === la && (b.row ?? 0) > (a.row ?? 0))) { from = `${fid}:bottom`; to = `${tid}:top`; }
      else { from = `${fid}:top`; to = `${tid}:bottom`; }
    }
    return {f, a, b, from, to, auto, under};
  });
  // each way back under a lane's boxes gets a depth of its own (the outer one of two that nest runs deeper; ones that only partly overlap differ too), so no two share a line or a label slot
  type Spec = typeof specs[number];
  const underAt = new Map<Spec, {group: string; level: number}>();
  const groups = new Map<string, {lane: string; row: number; label: boolean; levels: number}>();
  const reach = (sp: Spec): [number, number] => [sp.b.col + (sp.b.span - 1) / 2, sp.a.col + (sp.a.span - 1) / 2];
  for (const sp of [...specs.filter(x => x.under)].sort((x, y) => (reach(x)[1] - reach(x)[0]) - (reach(y)[1] - reach(y)[0]))) {
    const row = sp.a.row ?? 0, group = `${sp.a.lane}|${row}`, [lo, hi] = reach(sp);
    let level = 0;
    for (const [o, at] of underAt) if (at.group === group) { const [olo, ohi] = reach(o); if (lo < ohi && olo < hi) level = Math.max(level, at.level + 1); }
    underAt.set(sp, {group, level});
    const g = groups.get(group) ?? {lane: sp.a.lane, row, label: false, levels: 0};
    g.label ||= !!sp.f.label; g.levels = Math.max(g.levels, level + 1);
    groups.set(group, g);
  }
  // the ends that share a side of one step are spread along it. By the routes, not by the order written: along a bottom, the ends of ways back that leave to the left
  // come first (the deeper one nearer the middle), then the ends that go straight down, then the ends of ways back that come in from the right (the deeper one nearer the middle too);
  // so that nested and outer ways back from one box never cross, and two that meet at one box never share a run
  const ends = new Map<string, {sp: Spec; role: 'from' | 'to'; g: number; depth: number}[]>();
  for (const sp of specs) if (sp.auto || sp.under) for (const role of ['from', 'to'] as const) {
    const list = ends.get(sp[role]) ?? [];
    list.push({sp, role, g: !sp.under ? 1 : role === 'from' ? 0 : 2, depth: sp.under ? must(underAt.get(sp)).level : 0});
    ends.set(sp[role], list);
  }
  const slotRef = new Map<Spec, {from: string; to: string}>(specs.map(sp => [sp, {from: sp.from, to: sp.to}]));
  for (const [ref, list] of ends) {
    if (list.length < 2) continue;
    list.sort((x, y) => x.g - y.g || (x.g === 0 ? x.depth - y.depth : x.g === 2 ? y.depth - x.depth : 0));
    list.forEach((e, k) => { must(slotRef.get(e.sp))[e.role] = `${ref}@${((k + 1) / (list.length + 1)).toFixed(2)}`; });
  }
  const slot = new Map();
  const underFlows: NonNullable<SwimlaneBand['underFlows']> = [];
  const flows = specs.flatMap(sp => {
    const {f, b, auto, under} = sp, ref = must(slotRef.get(sp));
    if (under) {
      const at = must(underAt.get(sp)), g = must(groups.get(at.group));
      underFlows.push({from: ref.from, to: ref.to, ...(f.label === undefined ? {} : {label: f.label}), group: at.group, off: underOffset(g.label, at.level), moveLabel: f.labelAt === undefined});
      return [Object.assign(connectBand(ref.from, ref.to, {route: 'loop-under', label: f.label, chip: f.chip ?? !!f.label, labelAt: f.labelAt ?? 0.5, line: f.line, arrow: f.arrow, tone: f.tone}, false), {under: true as const})];
    }
    const k = slot.get(b.col) ?? 0; slot.set(b.col, k + 1);
    return [connectBand(auto ? ref.from : sp.from, auto ? ref.to : sp.to, {route: 'elbow', bend: f.bend ?? 'auto', bendOffset: f.bendOffset ?? 6 + (k % 3) * 7, label: f.label, chip: f.chip ?? !!f.label, labelAt: f.labelAt ?? 0.4, line: f.line, arrow: f.arrow, tone: f.tone}, false)];
  });
  if (opts.fit !== undefined && opts.fit !== 'shrink') throw new Error(`swimlane(): fit must be 'shrink' (got ${String(opts.fit)})`);
  // the room each row of a lane needs below its boxes for the ways back that run there
  const underNeed = [...groups.values()].map(g => ({lane: g.lane, row: g.row, need: underOffset(g.label, g.levels - 1) + (g.label ? UNDER_CHIP_HALF : 0) + UNDER_MARGIN}));
  const block: SwimlaneBand = {type: 'swimlane', lanes, steps: placed, cols, ...(underNeed.length ? {underNeed, underFlows, otherFlows: flows.filter(c => !c.under).map(c => ({from: c.from, to: c.to, ...(c.label === undefined ? {} : {label: c.label})}))} : {}), phases: opts.phases, ...(boundaries?.length ? {boundaries} : {}), labelW: opts.labelW, colGap: opts.colGap, ...(opts.fit === undefined ? {} : {fit: opts.fit}), id: opts.id, ...scopeOpt(opts, 'swimlane()'), ...revealOf(opts)};
  return withAnchors([block, ...flows], placed.map(st => st.id));
}

/** swimlane({laneOrder: 'auto'}): the lanes in the order with the shortest hand-offs between them, by the flows swimlane() was given. */
function orderLanes(lanes: SwimlaneLane[], steps: SwimlaneStep[], opts: SwimlaneOpts): SwimlaneLane[] {
  if (opts.laneOrder !== 'auto') throw new Error(`swimlane(): laneOrder must be 'auto' (got ${String(opts.laneOrder)})`);
  if (lanes.length > MAX_LANES_TO_ORDER) throw new Error(`swimlane(): laneOrder: 'auto' orders up to ${MAX_LANES_TO_ORDER} lanes (got ${lanes.length}) — split the figure, or drop laneOrder and order them by hand`);
  const laneOf = new Map(steps.filter(st => st.id !== undefined).map((st): [string, string] => [st.id as string, st.lane]));
  const idx = new Map(lanes.map((l, i) => [l.id, i]));
  // a flow that names an unknown step or lane is reported by the loops below; here it just does not count
  const pairs = (opts.flows ?? []).flatMap((f): [number, number][] => {
    const a = idx.get(laneOf.get(String(f.from).split(':')[0] as string) as string), b = idx.get(laneOf.get(String(f.to).split(':')[0] as string) as string);
    return a === undefined || b === undefined ? [] : [[a, b]];
  });
  const fixed = new Set(lanes.flatMap((l, i) => (l.fixed ? [i] : [])));
  return bestLaneOrder(lanes.length, fixed, pairs).map(i => lanes[i] as SwimlaneLane);
}
