// Public API: a vertical stack of bands (caption, box, banner, spacer, raw,
// row, grid, connect, pyramid, curve). bar() is the one primitive still
// deferred — nothing in this deck has needed it since row()/grid() covered
// the rest of the pattern catalog.
//
// Deliberately absent from every function signature: x, y, fill, stroke,
// font-family, and (on the normal path) font-size/height. That absence IS
// the constraint system — a caller cannot express an off-token color or a
// sub-14px font because there is no parameter that accepts one.

import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {layoutDiagram} from './layout.ts';
import {emitSvg} from './emit.ts';
import {verifyDiagram} from './verify.ts';
import {applyAutoLegend} from './rules.ts';
import {analyzeFit} from './fit.ts';
import {getSlideBudget} from './slide-budget.ts';
import {closeMeasurer} from './measure.ts';
import {MIN_FONT_SIZE, ROLES, THEMES} from './tokens.ts';
import type {
  Band, BandInput, BannerBand, BannerOpts, BoxBand, BoxOpts, BranchTarget, BuildResult, CaptionBand, CaptionOpts, CheckResult,
  ConnectBand, ConnectOpts, CurveBand, CurveOpts, Diagram, DiagramData, DiagramOpts, GridBand, GridOpts, GroupBand, GroupOpts,
  LaidOutDiagram, LegendBand, LegendItem, LegendOpts, PyramidBand, PyramidLayer, PyramidOpts, RawBand, RawOpts, RowBand, RowOpts,
  ScreensBand, ScreensItem, ScreensOpts, SequenceActor, SequenceBand, SequenceOpts, SequenceStep, SlideBudget, SpacerBand,
  Role, StateMatrixOpts, StateMatrixRow, SwimlaneBand, SwimlaneLane, SwimlaneOpts, SwimlaneStep, SwimlaneStepBand, TableBand,
  TableColumn, TableOpts, TableRow, Theme, WfNode, WfOverlay, WfPartKey, WfRoot, WireframeBand, WireframeOpts, Medium,
} from './types.ts';
import type {
  AnchorsOf, BoxInput, BranchInput, ConnectInput, CurvePoints, Declares, DiagramInput, FlowCheck, FlowIn, HandleOf, IdsOf,
  LaneCheck, Ok, PyramidLayers, Refers, RefsOf, ScreensItemInput, StateRowIn, StepCheck, StepIds, SwimlaneStepIn,
} from './strict.ts';
export {wf} from './wireframe.ts';

//
// Compile time (lib/strict.ts): the result remembers the anchor ids add() has seen, so a connect() ref to an id
// that is declared neither in the same add() call (before OR after the connect) nor earlier in a chained
// `.add().add()` is a type error. Forward refs across separate add() calls are therefore rejected by the types
// although the runtime allows them; and in the statement style `d.add(x); d.add(connect(...))` (the result is not
// assigned back) the type cannot see the earlier ids, so a call that declares nothing is not checked.
// diagram({theme | day}) is required; fill: true requires `slide`. The runtime checks below are unchanged.
export function diagram(opts: DiagramInput): Diagram<never>;
export function diagram(opts: DiagramOpts = {}): Diagram {
  // `theme` (name from tokens.ts PALETTE) is the general form; `day` (1|2) is the
  // training deck's legacy spelling of the same thing. Stored as d.day internally.
  const theme = opts.theme ?? opts.day;
  if (!THEMES.map(String).includes(String(theme))) throw new Error(`diagram({theme}) must be one of ${THEMES.join(', ')} (or legacy day: 1|2)`);
  const d: DiagramData = {
    day: theme as Theme,
    // 'slide' (legacy day: 1|2 diagrams) gets slide-fit warnings; 'doc' (theme: ...) does not.
    medium: (opts.medium ?? (opts.theme === undefined ? 'slide' : 'doc')) as Medium,
    title: opts.title, desc: opts.desc,            // exposed as the SVG's <title> / <desc> (doc medium)
    accept: opts.accept, // {'rule-id': 'why this finding is fine'} — shown as info instead of a warning
    legend: opts.legend, legendLabels: opts.legendLabels, // legend: 'auto' adds entries for every notation used but not listed
    width: opts.width ?? 940,
    pad: opts.pad ?? 20,
    gap: opts.gap ?? 16,
    maxDisplayHeight: opts.maxDisplayHeight, // slide room for the <img> (see fit.ts)
    minEffectiveFont: opts.minEffectiveFont,
    slide: opts.slide, // {page, heading}: measure the real budget from this slide (slide-budget.ts)
    fill: !!opts.fill, // fit-figure slide: build to the measured width/height, growing fonts to use the slack (see build())
    bands: [],
  };
  return {
    ...d,
    add(this: Diagram, ...bands: BandInput[]) { d.bands.push(...bands.flat()); return this; },
    get bands() { return d.bands; },
  } as Diagram;
}

// `const list = box({id: 'list'})`: a band built with an id also works as a handle (`list.right`, `list.at('top', 0.25)`),
// so connect() can name it without typing the id again. The helpers are NON-enumerable properties: spreading or
// serialising a band, and every existing consumer of bands, sees exactly what it saw before.
function handleFor(id: string) {
  const side = (s: string) => `${id}:${s}`;
  return {
    left: {value: side('left')}, right: {value: side('right')}, top: {value: side('top')}, bottom: {value: side('bottom')}, center: {value: side('center')},
    at: {value: (s: string, t: number) => `${id}:${s}@${t}`},
  };
}
function withHandle<T extends object>(band: T, id: string | undefined): T {
  if (id) Object.defineProperties(band, handleFor(id));
  return band;
}
// screens() / swimlane(): `.anchors.<id>` is the handle of each item / step that has an id.
function withAnchors<T extends object>(band: T, ids: (string | undefined)[]): T {
  const anchors: Record<string, object> = {};
  for (const id of ids) if (id) anchors[id] = Object.defineProperties({id}, handleFor(id));
  return Object.defineProperty(band, 'anchors', {value: anchors});
}

export function caption(text: string, opts: CaptionOpts = {}): CaptionBand {
  return {type: 'caption', text, align: opts.align ?? 'center', role: opts.role ?? 'label', tone: opts.tone ?? 'muted', bold: !!opts.bold, mono: !!opts.mono};
}

// `step`: a number/string drawn as a solid numbered badge over the title's
// own baseline (requires `title` — the badge has nothing to align to
// without it).
//
// Types: `step` requires `title`; `size` is one of FontSize (an integer >= 14); unknown keys are rejected; the
// literal `id` is remembered so connect() refs to it can be checked by add().
export function box<const Id extends string = never>(opts: BoxInput<Id>): BoxBand & Declares<Id> & HandleOf<Id>;
export function box(opts: BoxOpts): BoxBand {
  if (opts.size !== undefined) assertFontSize(opts.size);
  if (opts.step != null && !opts.title) throw new Error('box({step}) needs a title — the badge aligns to the title\'s first line');
  return withHandle({type: 'box', ...opts}, opts.id);
}

export function banner<const Id extends string = never>(opts: BannerOpts & {id?: Id}): BannerBand & Declares<Id> & HandleOf<Id>;
export function banner(opts: BannerOpts): BannerBand {
  return withHandle({type: 'banner', tone: opts.tone ?? 'accent', ...opts}, opts.id);
}

// A labelled frame around other bands (a network zone, a service boundary, a
// release phase). children: any bands (row, grid, box, nested group...).
// tone: 'muted' (default, grey fill) | 'accent' | 'plain' (white) | 'danger';
// dashed: draw the boundary dashed (default true for 'plain' = a trust/zone line).
// Types: the ids (and connect() refs) of the children are exposed to add().
export function group<C extends Band | Band[], const Id extends string = never>(children: C, opts?: GroupOpts & {id?: Id}): GroupBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & HandleOf<Id>;
export function group(children: BandInput, opts: GroupOpts = {}): GroupBand {
  return withHandle({type: 'group', children: [children].flat(), title: opts.title, titleTone: opts.titleTone, titleAlign: opts.titleAlign, tone: opts.tone ?? 'muted', dashed: opts.dashed ?? (opts.tone === 'plain' ? true : undefined), pad: opts.pad, id: opts.id}, opts.id);
}

// Key for line styles / tones used in the diagram. items:
//   {line: 'solid'|'dashed'|'dotted'|'double', arrow?: 'end'|'both'|'none', label}
//   {tone: 'accent'|'muted'|'plain'|'danger'|'new'|'changed'|'removed', label}
export function legend(items: LegendItem[], opts: LegendOpts = {}): LegendBand {
  return {type: 'legend', items, align: opts.align ?? 'center'};
}

// UML-style sequence diagram. actors: [{id, label, tone?}]. steps (in time order):
//   {from, to, label, line?: 'solid'|'dashed'|'dotted'|'double', arrow?, tone?, number?: false}
//   {self: id, label}                      — a call to the same participant
//   {note: text, over: id | [id, id]}      — a note box over one or more participants
//   {divider: text}                        — a phase separator across the whole width
// Messages are auto-numbered 1, 2, ... (sequence(..., {numbered: false}) to turn off) so
// the picture lines up with a numbered list in the surrounding text.
// Types: an `id` in opts becomes a connect() anchor.
export function sequence<const Id extends string = never>(actors: SequenceActor[], steps: SequenceStep[], opts?: SequenceOpts & {id?: Id}): SequenceBand & Declares<Id> & HandleOf<Id>;
export function sequence(actors: SequenceActor[], steps: SequenceStep[], opts: SequenceOpts = {}): SequenceBand {
  return withHandle({type: 'sequence', actors, steps, numbered: opts.numbered, id: opts.id}, opts.id);
}

// Table with a header row. columns: [{label, flex?, mono?, bold?, align?: 'left'|'center'|'right'}].
// rows: [cell, ...] or {cells: [...], tone?: 'accent'|'new'|'changed'|'removed'|'muted'|'danger'};
// a cell is a string or {text, tone?: 'accent'|'muted'|'danger', bold?, mono?, align?}.
// title adds an accent bar on top (an ER entity name, a table caption); header: false hides
// the column-label row; width narrows the table (centered).
export function table<const Id extends string = never>(columns: TableColumn[], rows: TableRow[], opts?: TableOpts & {id?: Id}): TableBand & Declares<Id> & HandleOf<Id>;
export function table(columns: TableColumn[], rows: TableRow[], opts: TableOpts = {}): TableBand {
  return withHandle({type: 'table', columns, rows, title: opts.title, header: opts.header, width: opts.width, tone: opts.tone, id: opts.id}, opts.id);
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
//   opts.labelW: width of the lane-label column (default 128)
// Returns an array (the lane block followed by its flows); d.add() accepts it directly.
//
// Types: at most 6 lanes (rule swimlane-lanes); every step.lane is a declared lane id; step ids are unique; flows'
// from / to are step ids (optionally ':side[@t]'); chip / labelAt need a label. The step ids are exposed to add().
export function swimlane<
  const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [],
>(lanes: L & LaneCheck<L>, steps: S & StepCheck<L, S>, opts?: Omit<SwimlaneOpts, 'flows'> & {flows?: F & FlowCheck<StepIds<S>, F>}): (SwimlaneBand & Declares<StepIds<S>> | ConnectBand)[] & AnchorsOf<StepIds<S>>;
export function swimlane(lanes: SwimlaneLane[], steps: SwimlaneStep[], opts: SwimlaneOpts = {}): (SwimlaneBand | ConnectBand)[] {
  const laneIdx = new Map(lanes.map((l, i) => [l.id, i]));
  let next = 1, cols = 0;
  const placed = steps.map(st => {
    if (!laneIdx.has(st.lane)) throw new Error(`swimlane(): step "${st.id ?? st.title}" uses unknown lane "${st.lane}"`);
    const span = st.span ?? 1;
    const col = st.col ?? next;
    next = col + span;
    cols = Math.max(cols, col + span - 1);
    if (st.size !== undefined) assertFontSize(st.size);
    return {...st, type: 'box' as const, col, span};
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
      const la = laneIdx.get(a.lane)!, lb = laneIdx.get(b.lane)!;
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
    return connectBand(from, to, {route: 'elbow', bend: f.bend ?? 'auto', bendOffset: f.bendOffset ?? 6 + (k % 3) * 7, label: f.label, chip: f.chip ?? !!f.label, labelAt: f.labelAt ?? 0.4, line: f.line, arrow: f.arrow, tone: f.tone});
  });
  const block: SwimlaneBand = {type: 'swimlane', lanes, steps: placed, cols, phases: opts.phases, labelW: opts.labelW, colGap: opts.colGap, id: opts.id};
  return withAnchors([block, ...flows], placed.map(st => st.id));
}

// Low-fidelity UI wireframe of ONE screen, with an optional column of numbered notes.
//   root: a wf.* node or an array of them (laid out top to bottom). See wireframe.ts for the parts.
//   opts: {id, title, tag ('新規' | '改修' | text), h (screen height, default 440; 'fit' = as tall as the content),
//          frame ('screen' (default, heavy) | 'light' | 'none' — use 'light'/'none' for a single component),
//          notes: [string | {title?, text, n?}]  — numbered 1.. to match `n:` on nodes,
//          noteW, skeleton (text becomes grey bars), marks: {new, changed} legend labels,
//          overlays: [wf.dialog(...), wf.toast(...)]  — drawn over the screen (a dialog dims it)}
// id makes the screen frame a connect() anchor.
export function wireframe<const Id extends string = never>(root: WfRoot, opts?: WireframeOpts & {id?: Id}): WireframeBand & Declares<Id> & HandleOf<Id>;
export function wireframe(root: WfRoot, opts: WireframeOpts = {}): WireframeBand {
  autoNumber(root, opts.overlays);
  return withHandle({type: 'wireframe', root, ...opts}, opts.id);
}

// `n: true` (on a node, on a part in `parts: {...}`, or on a map marker) means "number me": such callouts get consecutive
// numbers in reading order (top to bottom, left to right), continuing after any explicit numbers.
function autoNumber(...trees: (WfRoot | WfOverlay | WfOverlay[] | undefined)[]): void {
  const todo: ((n: number) => void)[] = []; // each one writes the number it is given back into its callout
  let max = 0;
  const num = (v: unknown) => { if (typeof v === 'number') max = Math.max(max, v); };
  const walk = (nd: WfNode | WfNode[] | undefined | null): void => {
    if (!nd || typeof nd !== 'object') return;
    if (Array.isArray(nd)) return nd.forEach(c => walk(c));
    if (!nd.t) return;
    const node = nd;
    if (node.n === true) todo.push(v => { node.n = v; }); else num(node.n);
    const parts = node.parts;
    if (parts) for (const [k, v] of Object.entries(parts)) { if (v === true) todo.push(nv => { parts[k as WfPartKey] = nv; }); else num(v); }
    if (node.t === 'map') for (const m of node.markers ?? []) { if (m.n === true) todo.push(v => { m.n = v; }); else num(m.n); }
    walk('children' in node ? node.children : undefined);
  };
  trees.forEach(t => walk(t));
  let next = max + 1;
  for (const set of todo) set(next++);
}

// Several screens as thumbnails in a grid — a screen-transition diagram. Join them with connect().
//   items: [{id, title, tag?, root, h?, skeleton?, at?: [row, col]}]   opts: {cols (3), gap (64), rowGap (56), h (320), skeleton}
//   at places an item explicitly; col may be fractional (0.5 = half a column in) to centre a parent over its children.
// Types: item ids are exposed to add() as connect() anchors; `at` is a [row, col] tuple.
export function screens<const Id extends string = never>(items: ScreensItemInput<Id>[], opts?: ScreensOpts): ScreensBand & Declares<Id> & AnchorsOf<Id>;
export function screens(items: ScreensItem[], opts: ScreensOpts = {}): ScreensBand {
  return withAnchors({type: 'screens', items, ...opts}, items.map(i => i.id));
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
export function stateMatrix<const C extends string[]>(cols: C, rows: StateRowIn<C>[], opts?: Omit<StateMatrixOpts, 'required'> & {required?: C[number][]}): ScreensBand;
export function stateMatrix(cols: string[], rows: StateMatrixRow[], opts: StateMatrixOpts = {}): ScreensBand {
  return {type: 'screens', items: [], matrix: {cols, rows, required: opts.required, labelW: opts.labelW, cellH: opts.cellH, gap: opts.gap, cellFrame: opts.cellFrame}, marks: opts.marks, skeleton: opts.skeleton, id: opts.id};
}

export function spacer(h: number): SpacerBand {
  return {type: 'spacer', h};
}

// children: box() descriptors. justify: 'stretch' (default — fill the row,
// each child's share set by its `flex`, default 1) | 'center' | 'start'
// (fixed width per child, via each child's `width` or row-level `width`).
// arrows: 'between' draws a solid arrow from each child's right edge to the
// next child's left edge, vertically centered on the row.
//
// cols: N puts the row on a shared N-column grid instead (children take
// `span` columns, default 1, optionally starting at 1-based `col`). Rows with
// the same cols/gap have identical column edges, so a box spanning two
// columns lines up exactly over two single-column boxes in the next row.
export function row<C extends BoxBand>(children: C[], opts?: RowOpts): RowBand & Declares<IdsOf<C>>;
export function row(children: BoxBand[], opts: RowOpts = {}): RowBand {
  return {type: 'row', cols: opts.cols, children, gap: opts.gap ?? 16, arrows: opts.arrows ?? 'none', justify: opts.justify ?? 'stretch', itemWidth: opts.width};
}

// children: box() descriptors, laid out in `cols` columns (wraps to
// additional rows automatically). Every cell in the same grid-row shares
// that row's tallest cell's height, same as row().
export function grid<C extends BoxBand>(children: C[], opts: GridOpts): GridBand & Declares<IdsOf<C>>;
export function grid(children: BoxBand[], opts: GridOpts): GridBand {
  if (!opts?.cols) throw new Error('grid(children, {cols}) needs cols');
  return {type: 'grid', children, cols: opts.cols, gap: opts.gap ?? 16};
}

// Draws an arrow/line between two named anchors — any box()/row()-child/
// grid()-child that was given an `id`. Refs are "id" (center) or
// "id:side" (side is left/right/top/bottom/center).
// route: 'straight' (default) | 'elbow' (orthogonal; `bend` 0..1, or 'start' / 'end' (the middle leg hugs the source / the target), or 'auto' (the first of end, start, 0.5, 0.25, 0.75 that crosses no other box) places the
// middle leg, default 0.5 — leave a box's bottom/top for a vertical-first
// fork, left/right for a horizontal-first one; leave a vertical gap between
// the tiers for the middle leg and its label) | 'loop-under' (down, across, up — for a
// cycle's return arrow, e.g. connect('step4:bottom', 'step1:bottom',
// {route: 'loop-under', dip: 32})).
// Consumes no vertical space — resolved after the whole stack is laid out,
// so `from`/`to` may reference boxes declared earlier OR later in the stack.
//
// Types: `from` / `to` must be well-formed ('id', 'id:side', 'id:side@t'; side = left|right|top|bottom|center; t = 0..1)
// and add() checks the id exists in the diagram. `dip` only with route 'loop-under'; `bend` / `bendOffset` only with
// route 'elbow'; `chip` / `labelAt` only with a `label`.
export function connect<const F extends string, const T extends string>(from: Ok<F>, to: Ok<T>, opts?: ConnectInput): ConnectBand & Refers<F | T>;
export function connect(from: string, to: string, opts: ConnectOpts = {}): ConnectBand {
  return connectBand(from, to, opts);
}

function connectBand(from: string, to: string, opts: ConnectOpts): ConnectBand {
  // arrow: 'end' (default) | 'both' | 'start' | 'none'  (legacy `marker: false` = 'none')
  // line:  'solid' (default) | 'dashed' | 'dotted' | 'double'  (legacy `dashed: true` = 'dashed')
  // labelAt: 0..1 along a straight/loop-under connector where the label/chip sits (default 0.5)
  // chip:  true puts the label in a bordered pill sitting ON the line (protocol / rate tags)
  const arrow = opts.arrow ?? (opts.marker === false ? 'none' : 'end');
  const line = opts.line ?? (opts.dashed ? 'dashed' : 'solid');
  return {type: 'connect', from, to, route: opts.route ?? 'straight', dip: opts.dip ?? 32, bend: opts.bend ?? 0.5, bendOffset: opts.bendOffset, arrow, line, chip: !!opts.chip, labelAt: opts.labelAt ?? 0.5, tone: opts.tone, label: opts.label};
}

// One box fanning out to several targets (a decision). `targets`:
// [{to, label?, tone?, dashed?}]; opts as connect() (route defaults to
// 'elbow'). Returns an array — d.add() flattens it.
export function branch<const F extends string, const To extends string>(from: Ok<F>, targets: (BranchInput & {to: Ok<To>})[], opts?: BranchInput): (ConnectBand & Refers<F | To>)[];
export function branch(from: string, targets: BranchTarget[], opts: ConnectOpts = {}): ConnectBand[] {
  return targets.map(t => connectBand(from, t.to, {route: 'elbow', ...opts, ...t}));
}

// Stacked trapezoid layers, bottom (widest) to top (narrowest) — a test
// pyramid, a maturity model, anything shaped like "few at the top, many at
// the bottom". `layers`: strings or {text}, bottom-to-top. Opacity and each
// layer's text color are derived (see tokens.ts's SHADES/bestTextColor),
// not chosen per diagram, so contrast is provably fine for any 2-6 layers.
// Types: a tuple of at least 2 layers.
export function pyramid(layers: PyramidLayers, opts?: PyramidOpts): PyramidBand;
export function pyramid(layers: (string | PyramidLayer)[], opts: PyramidOpts = {}): PyramidBand {
  if (!Array.isArray(layers) || layers.length < 2) throw new Error('pyramid(layers) needs at least 2 layers, bottom to top');
  return {
    type: 'pyramid',
    layers: layers.map(l => typeof l === 'string' ? {text: l} : l),
    width: opts.width,
    layerHeight: opts.layerHeight ?? 76,
    apexRatio: opts.apexRatio ?? 0.3,
  };
}

// An axis + a connected-dot trend line — a decay/growth curve, a shift-left
// curve, anything shaped like "value over an ordered sequence". `points`:
// {y: 0..1 (0 = axis bottom, 1 = axis top), emphasis?: 'accent'|'danger'|
// 'muted', dropLine?: true} evenly spaced left-to-right along the x-axis.
// Bespoke callouts (leader lines to side notes, etc.) are raw()'s job —
// curve() only draws the reusable skeleton.
// Types: a tuple of at least 2 points, each with a numeric y.
export function curve(points: CurvePoints, opts?: CurveOpts): CurveBand;
export function curve(points: CurveBand['points'], opts: CurveOpts = {}): CurveBand {
  if (!Array.isArray(points) || points.length < 2) throw new Error('curve(points) needs at least 2 points');
  for (const p of points) {
    if (typeof p.y !== 'number') throw new Error('curve(): every point needs a numeric y (0 = axis bottom, 1 = axis top)');
  }
  return {
    type: 'curve', points,
    height: opts.height ?? 220,
    width: opts.width,
    yTopLabel: opts.yTopLabel, yBottomLabel: opts.yBottomLabel, xLabel: opts.xLabel,
  };
}

// Escape hatch. `draw(ctx)` must return a raw SVG fragment string; it
// receives its allocated origin/size and a couple of tone-aware helpers, but
// nothing stops it from emitting arbitrary markup — the fragment is passed
// through emit.ts unmodified. build() runs `lint-svg.ts --strict` on the
// finished file regardless, so an off-token color or sub-14px size written
// here still gets caught before the file is trusted — raw() only escapes
// layout, never the constraint system's verification step.
export function raw(opts: RawOpts): RawBand {
  if (typeof opts.draw !== 'function') throw new Error('raw({draw}) needs a draw(ctx) function');
  return {type: 'raw', h: opts.h ?? 0, draw: opts.draw};
}

function assertFontSize(size: number): void {
  if (size < MIN_FONT_SIZE) {
    throw new Error(`font-size ${size} is below the ${MIN_FONT_SIZE}px floor — this deck never uses smaller text. Reconsider the layout instead of shrinking the text.`);
  }
}

// Lays out, verifies, renders, writes, and lints a diagram in one call.
// build(d, 'public/svg/day2-11-example.svg')
//
// Two verification layers, in order:
//   1. verifyDiagram() — pure-geometry checks on the laid-out tree, before
//      any SVG exists. Catches sibling/neighbor overlap, canvas-bounds
//      overflow, and low-contrast tone pairs in milliseconds, with no
//      Chromium render involved. This is the primary check.
//   2. lint-svg.ts --strict — a real Playwright render of the finished
//      file. Slower, but it's the only thing that can see what raw()
//      actually drew (verifyDiagram only checks raw()'s self-reported
//      x/y/w/h against its neighbors) and catches real-font-rendering
//      discrepancies verifyDiagram's measured-atom approximation can't.
export async function build(d: Diagram, outPath: string): Promise<BuildResult> {
  applyAutoLegend(d);
  // A diagram that names its slide gets a measured height budget and width
  // (cached) instead of fit.ts's defaults.
  let budget: SlideBudget | null = null;
  if (d.slide) {
    budget = await getSlideBudget({...d.slide, svg: path.basename(outPath)});
    d.maxDisplayHeight = budget.maxHeight;
    d.usableWidth = budget.contentWidth;
  }
  // fill: true (fit-figure slides) — the <img> is stretched to the slide's free
  // area, so draw for that area: canvas as wide as the slot, and the largest
  // font/pad/gap scale (>= 1) whose laid-out height still fits the slot's
  // height. Without this a short diagram leaves the slot half empty and its
  // 14px text is as small as it was at 940px wide.
  let fontScale = 1;
  let laidOut: LaidOutDiagram;
  const baseRoles = {...ROLES};
  const applyScale = (s: number) => { for (const k of Object.keys(baseRoles) as Role[]) ROLES[k] = Math.round(baseRoles[k] * s); };
  const layoutAt = (s: number) => { applyScale(s); return layoutDiagram({...d, pad: Math.round(d.pad * s), gap: Math.round(d.gap * s)}); };
  try {
    if (d.fill) {
      if (!budget) throw new Error('diagram({fill: true}) needs diagram({slide: {page, heading}}) to know the slot size');
      d.width = budget.contentWidth;
      let lo = 1, hi = 1.8;
      if ((await layoutAt(1)).canvasHeight > budget.maxHeight) hi = 1; // doesn't even fit at 1x: report via fit warnings
      for (let i = 0; i < 7 && hi - lo > 0.01; i++) {
        const mid = (lo + hi) / 2;
        if ((await layoutAt(mid)).canvasHeight <= budget.maxHeight) lo = mid; else hi = mid;
      }
      fontScale = Math.floor(lo * 100) / 100;
    }
    laidOut = await layoutAt(fontScale);
    laidOut.fontScale = fontScale;
    return await finishBuild(d, laidOut, outPath, budget);
  } finally {
    applyScale(1);
  }
}

// Layout + verification + rules, without writing any file: the engine behind `svg-diagram check`.
export async function checkDiagram(d: DiagramData): Promise<CheckResult> {
  applyAutoLegend(d);
  const laidOut = await layoutDiagram(d);
  return {laidOut, verdict: verifyDiagram(laidOut)};
}

async function finishBuild(d: DiagramData, laidOut: LaidOutDiagram, outPath: string, budget: SlideBudget | null): Promise<BuildResult> {
  const verdict = verifyDiagram(laidOut);
  if (!verdict.ok) {
    throw new Error(`build(${outPath}): layout verification failed before any SVG was written:\n  ${verdict.problems.join('\n  ')}`);
  }

  const svg = emitSvg(laidOut);
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, svg);

  const lintScript = path.resolve(import.meta.dirname, '..', 'lint-svg.ts');
  try {
    execFileSync('node', [lintScript, outPath, '--strict'], {encoding: 'utf8'});
  } catch (err) {
    const e = err as {stdout?: string; stderr?: string};
    const out = (e.stdout || '') + (e.stderr || '');
    throw new Error(`build(${outPath}) produced an SVG that fails lint-svg.ts --strict:\n${out}`);
  }
  const fit = analyzeFit(laidOut);
  return {outPath, width: laidOut.width, height: laidOut.canvasHeight, fit, budget, fontScale: laidOut.fontScale, warnings: verdict.warnings, findings: verdict.findings};
}

export {closeMeasurer};
