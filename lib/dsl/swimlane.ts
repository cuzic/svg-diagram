import {MAX_LANES_TO_ORDER, bestLaneOrder} from '../lane-order.ts';
import {resolveIcon} from '../icon-registry.ts';
import {assertSolidText, richBoxFields} from '../rich.ts';
import type {ConnectBand} from '../types/containers.ts';
import type {EmphasisTone} from '../types/core.ts';
import type {SwimlaneAutoBand, SwimlaneAutoFlow, SwimlaneAutoNode, SwimlaneBand, SwimlaneLane, SwimlaneOpts, SwimlaneStep, SwimlaneStepBand, SwimlaneStepKind, SwimlaneTimedBand} from '../types/sequence-table-swimlane.ts';
import type {AnchorsOf, Declares, FlowCheck, FlowIn, LaneCheck, StepCheck, StepIds, SwimlaneStepIn} from '../strict.ts';
import {must} from '../must.ts';
import {connectBand} from './defaults.ts';
import {graphTones, litLink, resolveFocus} from '../focus.ts';
import {assertBoxTone, assertFontSize, revealOf, scopeOpt, TREE_TONES, withAnchors} from './shared.ts';

// Swimlane diagram: who does what, in what order, and where the hand-offs are.
//   lanes: [{id, label, tone?, fixed?}]  (fixed: svg-diagram check never suggests moving this lane)  — horizontal bands, top to bottom (an actor, a team, a system)
//   steps: [{id, lane, title, body?, col?, span?, row?, tone?, tag?, ...any box() field}]
//          Columns are time. Listed in order, each step takes the column after the previous one;
//          give `col` to line up work that happens in parallel in different lanes.
//          `row` (0, 1, ...) stacks overlapping work of the SAME lane into sub-rows.
//   opts.flows:  [{from, to, label?, chip?, line?, arrow?, bend?}]  — step ids, or 'id:side[@t]' to choose the side.
//                Sides are picked from the lanes/columns: right->left across columns (the vertical leg sits
//                just before the target, so it never crosses a box in between), bottom<->top within a column.
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
export function swimlane<
  const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [], const Id extends string = never, const O extends object = object,
>(lanes: L & LaneCheck<L, O>, steps: S & StepCheck<L, S>, opts?: O & Omit<SwimlaneOpts, 'flows' | 'id'> & {id?: Id; flows?: F & FlowCheck<StepIds<S>, F>}): (SwimlaneBand & Declares<StepIds<S> | Id> | ConnectBand)[] & AnchorsOf<StepIds<S> | Id>;
export function swimlane(lanesIn: SwimlaneLane[], stepsIn: SwimlaneStep[], optsIn: SwimlaneOpts = {}): (SwimlaneBand | ConnectBand)[] {
  // `cols: 'auto'`: the columns follow the flow; the flows stay in the band (no connect bands) and focus runs on the nodes
  if (optsIn.cols === 'auto') return swimlaneAutoOf(lanesIn, stepsIn, optsIn);
  if (optsIn.cols !== undefined) throw new Error(`swimlane(): cols must be 'auto' (got ${JSON.stringify(optsIn.cols)})`);
  const {steps, opts} = optsIn.focus === undefined ? {steps: stepsIn, opts: optsIn} : focusSwimlane(stepsIn, optsIn);
  if (optsIn.focus !== undefined) {
    try { return swimlaneOf(lanesIn, steps, opts); } catch (e) {
      // what is left to refuse on a focused step is a coloured span of its text: say that focus made it solid
      throw e instanceof Error && /tone 'solid'/.test(e.message) ? new Error(`swimlane(): focus fills the step (tone 'solid', white text): ${e.message}`) : e;
    }
  }
  return swimlaneOf(lanesIn, steps, opts);
}
function swimlaneOf(lanesIn: SwimlaneLane[], steps: SwimlaneStep[], opts: SwimlaneOpts): (SwimlaneTimedBand | ConnectBand)[] {
  // dir: 'h' is the documented default: a no-op on explicit columns (only 'v' needs cols: 'auto', ADR 0086 D1)
  if (opts.dir !== undefined && opts.dir !== 'h' && opts.dir !== 'v') throw new Error(`swimlane(): dir must be 'h' or 'v' (got ${String(opts.dir)})`);
  if (opts.dir === 'v') throw new Error(`swimlane(): dir needs cols: 'auto' (got dir: 'v' on explicit columns)`);
  for (const st of steps) {
    if (st.kind !== undefined && st.kind !== 'task') throw new Error(`swimlane(): step "${st.id}" has kind '${st.kind}': add cols: 'auto' or drop kind`);
  }
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
    let from = f.from, to = f.to, auto = false;
    if (!fside && !tside) {
      auto = true;
      const la = must(laneIdx.get(a.lane)), lb = must(laneIdx.get(b.lane)); // every step's lane was checked against `laneIdx` above
      if (b.col > a.col + a.span - 1) { from = `${fid}:right`; to = `${tid}:left`; }
      else if (a.col > b.col + b.span - 1) { from = `${fid}:left`; to = `${tid}:right`; }
      else if (lb > la || (lb === la && (b.row ?? 0) > (a.row ?? 0))) { from = `${fid}:bottom`; to = `${tid}:top`; }
      else { from = `${fid}:top`; to = `${tid}:bottom`; }
    }
    return {f, a, b, from, to, auto};
  });
  const uses = new Map();
  const note = (k: string) => uses.set(k, (uses.get(k) ?? 0) + 1);
  for (const sp of specs) if (sp.auto) { note(sp.from); note(sp.to); }
  const seen = new Map();
  const spread = (ref: string): string => {
    const n = uses.get(ref) ?? 1;
    if (n < 2) return ref;
    const k = seen.get(ref) ?? 0; seen.set(ref, k + 1);
    return `${ref}@${((k + 1) / (n + 1)).toFixed(2)}`;
  };
  const slot = new Map();
  const flows = specs.map(({f, b, from, to, auto}) => {
    if (auto) { from = spread(from); to = spread(to); }
    const k = slot.get(b.col) ?? 0; slot.set(b.col, k + 1);
    return connectBand(from, to, {route: 'elbow', bend: f.bend ?? 'auto', bendOffset: f.bendOffset ?? 6 + (k % 3) * 7, label: f.label, chip: f.chip ?? !!f.label, labelAt: f.labelAt ?? 0.4, line: f.line, arrow: f.arrow, tone: f.tone}, false);
  });
  if (opts.fit !== undefined && opts.fit !== 'shrink') throw new Error(`swimlane(): fit must be 'shrink' (got ${String(opts.fit)})`);
  const block: SwimlaneTimedBand = {type: 'swimlane', lanes, steps: placed, cols, phases: opts.phases, ...(boundaries?.length ? {boundaries} : {}), labelW: opts.labelW, colGap: opts.colGap, ...(opts.fit === undefined ? {} : {fit: opts.fit}), id: opts.id, ...scopeOpt(opts, 'swimlane()'), ...revealOf(opts)};
  return withAnchors([block, ...flows], placed.map(st => st.id));
}

/** `swimlane()` with `cols: 'auto'`: steps carry `kind` / `title` / `body`, the columns follow the flow, and the flows stay in the band. */
const AUTO_STEP_KEYS = ['id', 'lane', 'kind', 'title', 'body', 'icon', 'iconTone', 'tone'];
const AUTO_STEP_KINDS = ['task', 'start', 'end', 'xor', 'and', 'or'];
function swimlaneAutoOf(lanesIn: SwimlaneLane[], stepsIn: SwimlaneStep[], opts: SwimlaneOpts): SwimlaneAutoBand[] {
  if (!Array.isArray(lanesIn) || lanesIn.length === 0) throw new Error('swimlane(lanes, steps) needs at least one lane');
  if (!Array.isArray(stepsIn) || stepsIn.length === 0) throw new Error('swimlane(lanes, steps) needs at least one step');
  for (const key of ['phases', 'boundaries', 'labelW', 'colGap'] as const) {
    if (opts[key] !== undefined) throw new Error(`swimlane(): ${key} needs explicit columns; drop ${key} or drop cols: 'auto'`);
  }
  if (opts.dir !== undefined && opts.dir !== 'h' && opts.dir !== 'v') throw new Error(`swimlane(): dir must be 'h' or 'v' (got ${String(opts.dir)})`);
  if (opts.fit !== undefined && opts.fit !== 'shrink') throw new Error(`swimlane(): fit must be 'shrink' (got ${String(opts.fit)})`);
  if (opts.dir === 'v' && opts.fit !== undefined) throw new Error("swimlane(): fit: 'shrink' is for the horizontal figure; a vertical one (dir: 'v') takes its column width from the lanes");
  const lanes = opts.laneOrder === undefined ? lanesIn : orderLanes(lanesIn, stepsIn, opts);
  for (const l of lanes) assertBoxTone(l.tone, `swimlane() lane "${l.id}"`);
  const nodes: SwimlaneAutoNode[] = stepsIn.map(st => {
    const rec = st as unknown as Record<string, unknown>;
    const id = typeof rec['id'] === 'string' ? rec['id'] : '(missing id)';
    for (const key of ['col', 'span', 'row', 'reveal', 'until']) {
      if (rec[key] !== undefined) throw new Error(`swimlane(): step "${id}" has ${key}, which needs explicit columns; drop ${key} or drop cols: 'auto'`);
    }
    for (const key of Object.keys(rec)) {
      if (!AUTO_STEP_KEYS.includes(key)) throw new Error(`swimlane(): step "${id}" has ${key}; with cols: 'auto' a step takes ${AUTO_STEP_KEYS.join(', ')} only`);
    }
    const kind = (rec['kind'] ?? 'task') as string;
    if (!AUTO_STEP_KINDS.includes(kind)) throw new Error(`swimlane(): step "${id}" has kind ${String(rec['kind'])} (use ${AUTO_STEP_KINDS.join(' | ')})`);
    if (rec['title'] !== undefined && typeof rec['title'] !== 'string') throw new Error(`swimlane(): step "${id}" title must be a plain string with cols: 'auto'`);
    if (rec['body'] !== undefined && typeof rec['body'] !== 'string') throw new Error(`swimlane(): step "${id}" body must be a plain string with cols: 'auto'`);
    if (rec['tone'] !== undefined && !TREE_TONES.includes(rec['tone'] as string)) throw new Error(`swimlane(): step "${id}" has tone ${String(rec['tone'])} (use ${TREE_TONES.join(', ')})`);
    if ((rec['icon'] !== undefined || rec['iconTone'] !== undefined) && kind !== 'task') throw new Error(`swimlane(): step "${id}" is a ${kind} event/gateway; only a task takes an icon`);
    if (rec['iconTone'] !== undefined && rec['icon'] === undefined) throw new Error(`swimlane(): step "${id}" has iconTone but no icon`);
    return {
      id: st.id as string, lane: st.lane,
      ...(kind === 'task' ? {} : {kind: kind as SwimlaneStepKind}),
      ...(typeof rec['title'] === 'string' ? {label: rec['title']} : {}),
      ...(typeof rec['body'] === 'string' ? {sub: rec['body']} : {}),
      ...(typeof rec['tone'] === 'string' ? {tone: rec['tone'] as EmphasisTone} : {}),
      ...(st.icon === undefined ? {} : {icon: st.icon, iconGlyph: resolveIcon(st.icon, `swimlane() step "${id}" icon`)}),
      ...(st.iconTone === undefined ? {} : {iconTone: st.iconTone}),
    };
  });
  const flows: SwimlaneAutoFlow[] = (opts.flows ?? []).map(f => {
    // a key neither loop names is dropped silently, like the explicit path (which reads only the fields it knows)
    const rec = f as unknown as Record<string, unknown>;
    for (const key of ['chip', 'labelAt', 'bend', 'bendOffset', 'arrow', 'tone']) {
      if (rec[key] !== undefined) throw new Error(`swimlane(): flow ${String(rec['from'])} -> ${String(rec['to'])} has ${key}; with cols: 'auto' a flow takes from, to, label, line only`);
    }
    for (const end of [rec['from'], rec['to']]) {
      if (typeof end === 'string' && end.includes(':')) throw new Error(`swimlane(): flow ${String(rec['from'])} -> ${String(rec['to'])}: 'id:side@t' needs explicit columns; name plain step ids`);
    }
    if (rec['line'] !== undefined && rec['line'] !== 'solid' && rec['line'] !== 'dashed') throw new Error(`swimlane(): flow ${String(rec['from'])} -> ${String(rec['to'])} has line ${String(rec['line'])} (use solid | dashed)`);
    return {from: f.from, to: f.to, ...(f.label === undefined ? {} : {label: f.label}), ...(f.line === undefined ? {} : {line: f.line as 'solid' | 'dashed'})};
  });
  const focused = opts.focus === undefined ? undefined : resolveFocus(opts.focus, nodes.map(n => n.id), 'swimlane()');
  const toned = focused === undefined ? nodes : (() => {
    const ids = nodes.map(n => n.id), tones = graphTones(ids.length, flows.map(f => [ids.indexOf(f.from), ids.indexOf(f.to)] as const), focused);
    return nodes.map((n, i) => ({...n, tone: must(tones[i])}));
  })();
  const band: SwimlaneAutoBand = {type: 'swimlane', arrange: 'auto', lanes: [...lanes], nodes: toned, flows, ...(focused === undefined ? {} : {focused: [...focused].map(i => must(nodes[i]).id)}), ...(opts.id === undefined ? {} : {id: opts.id}), ...(opts.fit === undefined ? {} : {fit: opts.fit}), ...(opts.dir === 'v' ? {dir: 'v' as const} : {}), ...scopeOpt(opts, 'swimlane()'), ...revealOf(opts)};
  return withAnchors([band], nodes.map(n => n.id));
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
