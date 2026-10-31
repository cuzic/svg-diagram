import {MAX_LANES_TO_ORDER, bestLaneOrder} from '../lane-order.ts';
import {resolveIcon} from '../icon-registry.ts';
import {assertSolidText, richBoxFields} from '../rich.ts';
import type {ConnectBand} from '../types/containers.ts';
import type {SequenceActor, SequenceBand, SequenceOpts, SequenceStep, SwimlaneBand, SwimlaneLane, SwimlaneOpts, SwimlaneStep, SwimlaneStepBand, TableBand, TableCell, TableCellSpec, TableColumn, TableOpts, TableRow} from '../types/sequence-table-swimlane.ts';
import type {WfNode} from '../types/wireframe-nodes.ts';
import type {ScreensBand, StateMatrixOpts, StateMatrixRow, PartRow, StateCellIn, StateMatrixCell} from '../types/wireframe.ts';
import type {ActorIn, AnchorsOf, Declares, FlowCheck, FlowIn, LaneCheck, HandleOf, SeqStepIn, StateRowLoose, StepCheck, ValidateStateRows, StepIds, SwimlaneStepIn} from '../strict.ts';
import {must} from '../must.ts';
import {connectBand} from './defaults.ts';
import {assertBoxTone, assertFontSize, assertNoReveal, revealOf, scopeOpt, withAnchors, withHandle} from './shared.ts';

// UML-style sequence diagram. actors: [{id, label, tone?}]. steps (in time order):
//   {from, to, label, line?: 'solid'|'dashed'|'dotted'|'double', arrow?, tone?, number?: false}
//   {self: id, label}                      — a call to the same participant
//   {note: text, over: id | [id, id]}      — a note box over one or more participants
//   {divider: text}                        — a phase separator across the whole width
// Messages are auto-numbered 1, 2, ... (sequence(..., {numbered: false}) to turn off) so
// the picture lines up with a numbered list in the surrounding text.
// Types: every `from` / `to` / `self` / `over` must be a declared actor id, and `from` may not equal `to`
// (runtime: "unknown actor" / "use {self: id}"); an `id` in opts becomes a connect() anchor.
export function sequence<const A extends string, const Id extends string = never>(actors: ActorIn<A>[], steps: SeqStepIn<NoInfer<A>>[], opts?: SequenceOpts & {id?: Id}): SequenceBand & Declares<Id> & HandleOf<Id>;
export function sequence(actors: SequenceActor[], steps: SequenceStep[], opts: SequenceOpts = {}): SequenceBand {
  for (const a of actors) assertBoxTone(a.tone, `sequence() actor "${a.id}"`);
  // an icon is resolved here (the shell) and carried on the actor, so layout and emit stay free of I/O
  if (actors.some(a => a.iconTone !== undefined && a.icon === undefined)) throw new Error('sequence(): an actor has iconTone but no icon');
  actors = actors.map(a => a.icon === undefined ? a : {...a, iconGlyph: resolveIcon(a.icon, `sequence() actor "${a.id}" icon`)});
  for (const st of steps) if ('note' in st) assertBoxTone((st as {tone?: string}).tone, 'sequence() note');
  return withHandle({type: 'sequence', actors, steps, numbered: opts.numbered, id: opts.id, ...revealOf(opts)}, opts.id);
}
// Table with a header row. columns: [{label, flex?, mono?, bold?, align?: 'left'|'center'|'right'}].
// rows: [cell, ...] or {cells: [...], tone?: 'accent'|'new'|'changed'|'removed'|'muted'|'danger'};
// a cell is a string or {text, tone?: 'accent'|'muted'|'danger', bold?, mono?, align?}.
// title adds an accent bar on top (an ER entity name, a table caption); header: false hides
// the column-label row; width narrows the table (centered); cellH fixes every row's height (text centred; throws if a cell needs more),
// a row's own `h` and headerH override it for that row / the header; dense trims the row padding to 4px;
// rowHeader: true makes the left column a row heading (bold, soft fill, heavy rule on its right; top-aligned unless the row has a fixed height).
export function table<const Id extends string = never>(columns: TableColumn[], rows: readonly TableRow[], opts?: TableOpts & {id?: Id}): TableBand & Declares<Id> & HandleOf<Id>;
export function table(columns: TableColumn[], rows: readonly TableRow[], opts: TableOpts = {}): TableBand {
  assertBoxTone(opts.tone, 'table()');
  rows.forEach((r, i) => { if (!Array.isArray(r)) assertBoxTone((r as {tone?: string}).tone, `table() row ${i}`); });
  if (opts.rowHeader !== undefined && typeof opts.rowHeader !== 'boolean') throw new Error(`table(): rowHeader must be true or false, got ${JSON.stringify(opts.rowHeader)}`);
  if (opts.rowHeader && columns.length < 2) throw new Error('table(): rowHeader needs at least 2 columns (the first is the row heading, the rest are the body)');
  // an icon is resolved here (the shell) and carried on the cell, so layout and emit stay free of I/O
  const withGlyph = (c: TableCell): TableCell => typeof c === 'object' && c.icon !== undefined ? {...c, iconGlyph: resolveIcon(c.icon, 'table() cell icon')} : c;
  const placedRows = rows.map(r => Array.isArray(r) ? r.map(withGlyph) : {...(r as {cells: readonly TableCell[]}), cells: (r as {cells: readonly TableCell[]}).cells.map(withGlyph)}) as TableRow[];
  return withHandle({type: 'table', columns, rows: placedRows, title: opts.title, header: opts.header, width: opts.width, tone: opts.tone, cellH: opts.cellH, headerH: opts.headerH, dense: opts.dense, rowHeader: opts.rowHeader, id: opts.id, ...revealOf(opts)}, opts.id);
}
// A table cell with a status symbol: `cell('通る', {mark: 'ok'})` draws "○ 通る" in the accent tone; mark: 'ok' ○ | 'mid' △ | 'ng' × | 'best' ◎.
// `cell('', {mark: 'ng'})` is the symbol alone. The symbol says it, the colour only reinforces it (never colour alone).
//
// A table cell whose tone stays a literal when the cell is built apart from the table() call
// (`const c = {text: '通る', tone: 'accent'}` widens tone to string; `cell('通る', {tone: 'accent'})` does not).
export function cell(text: string | number, opts: Omit<TableCellSpec, 'text'> = {}): TableCellSpec {
  return {text: String(text), ...opts};
}
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
//   opts.labelW: width of the lane-label column (default 128)
//   opts.laneOrder: 'auto' puts the lanes in the order that makes the hand-offs (opts.flows) shortest; `fixed: true` lanes stay put (lib/lane-order.ts)
// Returns an array (the lane block followed by its flows); d.add() accepts it directly.
//
// Types: at most 6 lanes (rule swimlane-lanes); every step.lane is a declared lane id; step ids are unique; flows'
// from / to are step ids (optionally ':side[@t]'); chip / labelAt need a label. The step ids are exposed to add().
export function swimlane<
  const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [], const Id extends string = never,
>(lanes: L & LaneCheck<L>, steps: S & StepCheck<L, S>, opts?: Omit<SwimlaneOpts, 'flows' | 'id'> & {id?: Id; flows?: F & FlowCheck<StepIds<S>, F>}): (SwimlaneBand & Declares<StepIds<S> | Id> | ConnectBand)[] & AnchorsOf<StepIds<S> | Id>;
export function swimlane(lanesIn: SwimlaneLane[], steps: SwimlaneStep[], opts: SwimlaneOpts = {}): (SwimlaneBand | ConnectBand)[] {
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
  const block: SwimlaneBand = {type: 'swimlane', lanes, steps: placed, cols, phases: opts.phases, ...(boundaries?.length ? {boundaries} : {}), labelW: opts.labelW, colGap: opts.colGap, ...(opts.fit === undefined ? {} : {fit: opts.fit}), id: opts.id, ...scopeOpt(opts, 'swimlane()'), ...revealOf(opts)};
  return withAnchors([block, ...flows], placed.map(st => st.id));
}
// A component's states as a grid: one row per part, one column per state.
//   cols: ['通常', '読み込み中', '空', 'エラー', ...]
//   rows: [{label, note?, cells: [node | 'na' | {na: 'reason'} | undefined]}]  — a cell is a wf.* node (drawn in a light frame),
//         'na' / {na} (not applicable, drawn dashed), or missing (drawn as "未設計": a gap in the spec, which `svg-diagram check` reports).
//   opts: {required: [...cols that must exist], labelW, cellH (default: fit the content, min 72), cellFrame ('light' (default) | 'none' — 'none' when the parts already have their own border), gap, marks, skeleton}
//
// Types: `required` entries must be members of `cols` (rule wf-states-required), and each row's `cells` has EXACTLY
// cols.length entries: too many is rule wf-states-ragged, too few would silently draw '未設計' (wf-states-todo).
// An explicit `undefined` entry is still the deliberate TODO marker; 'na' / {na: reason} stay valid.
export function stateMatrix<const C extends string[], const R extends readonly (StateRowLoose | PartRow<never, string>)[]>(cols: C, rows: readonly [...R] & ValidateStateRows<C, R>, opts?: Omit<StateMatrixOpts, 'required'> & {required?: C[number][]}): ScreensBand;
export function stateMatrix(cols: string[], rowsIn: readonly (StateMatrixRow | PartRow<never>)[], opts: StateMatrixOpts = {}): ScreensBand {
  assertNoReveal(opts, 'stateMatrix()');
  const rows = rowsIn.map((r): StateMatrixRow => 'type' in r && r.type === 'part-row' ? {label: r.label, note: r.note, cells: r.cells(cols)} : r as StateMatrixRow);
  return {type: 'screens', items: [], matrix: {cols, rows, required: opts.required, labelW: opts.labelW, cellH: opts.cellH, gap: opts.gap, cellFrame: opts.cellFrame}, marks: opts.marks, skeleton: opts.skeleton, id: opts.id};
}
// One part drawn once per state: `part` is the function that builds it (the one you would call as `part({state: 'loading'})`),
// `states` says, per column, what differs from `base`:
//   {} (as is) | {state: 'loading', ...} (options merged over `base`) | 'loading' (= {state: 'loading'}) | 'na' | {na: reason} | undefined (未設計)
// Types: `states` has a key for every column of the matrix (a state left out is a type error, like a short `cells` row).
//   stateMatrix(['通常', '読み込み中', '空'], [
//     stateRow('在庫カード', stock, {通常: {}, 読み込み中: 'loading', 空: {na: '必ず 1 件ある'}}),
//     stateRow('検索結果', results, {通常: {}, 読み込み中: 'loading', 空: {state: 'empty', stateNote: '該当なし'}}, {note: '0 件のとき空'}),
//   ])
export function stateRow<const K extends string, O extends object = Record<string, unknown>, const L extends string = string>(
  label: L, part: ((o?: O) => WfNode) | ((o: O) => WfNode), states: {[P in K]: StateCellIn<NoInfer<O>>}, opts: {note?: string; base?: Partial<NoInfer<O>>} = {},
): PartRow<K, L> {
  return {
    type: 'part-row', label, note: opts.note,
    cells(cols) {
      for (const k of Object.keys(states)) if (!cols.includes(k)) throw new Error(`stateRow("${label}"): "${k}" is not a column of the matrix (${cols.join(', ')})`);
      return cols.map((col): StateMatrixCell => {
        const v = (states as Record<string, StateCellIn<O>>)[col];
        if (v === undefined || v === 'na' || v === 'todo') return v;
        const call = part as (o: O) => WfNode;
        if (typeof v === 'string') return call({...opts.base, state: v} as unknown as O);
        if (Object.keys(v).length === 1 && 'na' in v && typeof v.na === 'string') return {na: v.na}; // `{na: reason}` alone; a part's own `na` option comes with others
        return call({...opts.base, ...v} as O);
      });
    },
  };
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
