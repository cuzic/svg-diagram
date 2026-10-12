// Public API: a vertical stack of bands (caption, box, banner, spacer, raw,
// row, grid, connect, pyramid, curve, bars).
//
// Deliberately absent from every function signature: x, y, fill, stroke,
// font-family, and (on the normal path) font-size/height. That absence IS
// the constraint system — a caller cannot express an off-token color or a
// sub-14px font because there is no parameter that accepts one.

import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {wf} from './wireframe.ts';
import {resolveIcon} from './icon-registry.ts';
import {readImage} from './image-file.ts';
import {layoutDiagram} from './layout-measured.ts';
import {mapOf} from './tokens.ts';
import {timelineDay} from './timeline.ts';
import {emitSvg} from './emit.ts';
import {emitHtml} from './emit-html.ts';
import {xmlProblems} from './xml-check.ts';
import {verifyDiagram} from './verify.ts';
import {applyAutoLegend, walkBands} from './rules.ts';
import {analyzeFit} from './fit.ts';
import {getSlideBudget, readSlideBudgetCache} from './slide-budget.ts';
import {closeMeasurer} from './measure.ts';
import {applySpotlight} from './spotlight.ts';
import {prepareReveal} from './reveal.ts';
import {assertSolidText, richBoxFields, richField} from './rich.ts';
import {SLIDE_CANVAS, canvasFontScale, canvasRoles, MIN_FONT_SIZE, ROLES, THEMES, HEADLINE_ROLES, LABEL_ROLES, OPT_IN_TEXT_MAX, isSolidTone, scaleRoles} from './tokens.ts';
import type {
  Roles, Band, BandInput, BannerBand, BannerOpts, BarDatum, BarsBand, BarsOpts, ImageBand, ImageMark, ImageOpts, ImageRect, TimelineBand, TimelineOpts, TreeBand, TreeItem, TreeOpts, MindmapOpts, StatesBand, StatesOpts, StateItem, Transition, BoxBand, BoxOpts, BranchTarget, BuildResult, RenderResult, Verdict, CaptionBand, CaptionOpts, CheckResult,
  ConnectBand, ConnectDefaults, PlaneBand, PlaneOpts, ConnectOpts, CurveBand, CurveOpts, Diagram, DiagramData, DiagramOpts, GridBand, GridOpts, GroupBand, GroupOpts,
  LaidOutDiagram, LegendBand, LegendItem, PeopleBand, PeopleOpts, DotsBand, DotsOpts, DotDatum, LegendOpts, PyramidBand, PyramidLayer, PyramidOpts, RawBand, RawOpts, RowBand, RowOpts, BoxTone, TextTone,
  ScreensBand, ScreensItem, ScreensOpts, SequenceActor, SequenceBand, SequenceOpts, SequenceStep, SlideBudget, SpacerBand,
  Role, RichText, StatOpts, StateMatrixOpts, StateMatrixRow, SwimlaneBand, SwimlaneLane, SwimlaneOpts, SwimlaneStep, SwimlaneStepBand, TableBand,
  GroupRowBand, PartRow, StateCellIn, StateMatrixCell, TableCellSpec, TableColumn, TableOpts, TableRow, Theme, WfNode, WfOverlay, WfPartKey, WfRoot, WfScreen, WfShellProps, WireframeBand, WireframeDefaults, WireframeOpts, Medium,
} from './types.ts';
import type {
  ActorIn, AnchorsOf, BoxInput, BranchInput, ConnectInput, CurvePoints, Declares, DiagramInput, FlowCheck, FlowIn, IdsOf, LaneCheck, Ok,
  HandleOf, PyramidLayers, Refers, RefsOf, RowHandleOf, SeqStepIn, ScreensItemInput, StateRowIn, StateRowLoose, StepCheck, ValidateStateRows, StepIds, SwimlaneStepIn,
} from './strict.ts';
export {wf} from './wireframe.ts';
export {icon} from './icon-registry.ts';
export type {IconName, EmojiName} from './icons.ts';
import type {IconName} from './icons.ts';
export {versus} from './versus.ts';
export {em} from './rich.ts';
export type {VersusConnectLabels, VersusOpts, VersusPart, VersusSharedOpts} from './versus.ts';
// Every public type (WfNode, TableCell, TextTone, RawColorTone, ...) so project code never has to spell Parameters<typeof wf.col>[0].
export type * from './types.ts';

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
  if (typeof opts.spotlight === 'object' && opts.spotlight.mutedOk !== undefined && typeof opts.spotlight.mutedOk !== 'boolean') throw new Error(`diagram({spotlight: {mutedOk}}) must be true or false (got ${String(opts.spotlight.mutedOk)})`);
  if (typeof opts.spotlight === 'object' && opts.spotlight.dim !== undefined && !['outline', 'fill'].includes(opts.spotlight.dim)) throw new Error(`diagram({spotlight: {dim}}) must be 'outline' or 'fill' (got ${String(opts.spotlight.dim)})`);
  if (opts.appearance !== undefined && !['light', 'dark'].includes(opts.appearance as string) && !(typeof opts.appearance === 'object' && opts.appearance && typeof opts.appearance.dark === 'object')) throw new Error(`diagram({appearance}) must be 'light', 'dark' or {dark: {bg, text, ...}} (got ${JSON.stringify(opts.appearance)})`);
  mapOf(opts.appearance); // a custom dark set is validated here
  if (opts.sourceLine !== undefined && (typeof opts.sourceLine !== 'string' || !opts.sourceLine.trim() || /[\r\n]/.test(opts.sourceLine))) throw new Error('diagram({sourceLine}) must be a non-empty single-line string (e.g. "出典: 総務省 2025")');
  if (opts.canvas !== undefined && (opts.slide || opts.fill)) throw new Error('diagram({canvas}) is a whole slide drawn 1:1; it cannot be combined with `slide` / `fill` (those fit a figure into a measured slot of a Slidev slide)');
  const canvas = opts.canvas === undefined ? undefined : {...SLIDE_CANVAS, ...(opts.canvas === 'slide' ? {} : opts.canvas)};
  const d: DiagramData = {
    day: theme as Theme,
    appearance: opts.appearance, transparent: opts.transparent,
    // 'slide' (legacy day: 1|2 diagrams) gets slide-fit warnings; 'doc' (theme: ...) does not.
    medium: (opts.medium ?? (opts.theme === undefined ? 'slide' : 'doc')) as Medium,
    title: opts.title, desc: opts.desc,            // exposed as the SVG's <title> / <desc> (doc medium)
    accept: opts.accept, // {'rule-id': 'why this finding is fine'} — shown as info instead of a warning
    legend: opts.legend, legendLabels: opts.legendLabels, // legend: 'auto' adds entries for every notation used but not listed
    width: opts.width ?? canvas?.width ?? 940,
    canvas,
    pad: opts.pad ?? 20,
    gap: opts.gap ?? 16,
    maxDisplayHeight: opts.maxDisplayHeight, // slide room for the <img> (see fit.ts)
    minEffectiveFont: opts.minEffectiveFont,
    slide: opts.slide, // {page, heading}: measure the real budget from this slide (slide-budget.ts)
    connectDefaults: opts.connectDefaults, wireframeDefaults: opts.wireframeDefaults,
    spotlight: opts.spotlight,
    sourceLine: opts.sourceLine,
    fill: !!opts.fill, // fit-figure slide: build to the measured width/height, growing fonts to use the slack (see build())
    bands: [],
  };
  return {
    ...d,
    add(this: Diagram, ...bands: BandInput[]) {
      let flat = bands.flat();
      if (d.connectDefaults) flat = applyConnectDefaults(flat, d.connectDefaults);
      if (d.wireframeDefaults) flat = applyWireframeDefaults(flat, d.wireframeDefaults);
      d.bands.push(...flat);
      return this;
    },
    connect(this: Diagram, from: string, to: string, opts: ConnectOpts = {}) { return this.add(connectBand(from, to, opts)); },
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

// text: a string (exactly its characters) or an array with em.* parts: caption(['Claude in ', em.b('Chrome')]).
export function caption(text: RichText, opts: CaptionOpts = {}): CaptionBand {
  const tone = opts.tone ?? 'muted';
  const rich = richField(text, {field: 'caption()', bold: !!opts.bold, tone});
  return {type: 'caption', text: rich.text ?? '', ...(rich.spans ? {spans: {text: rich.spans}} : {}), align: opts.align ?? 'center', role: opts.role ?? 'label', tone, bold: !!opts.bold, mono: !!opts.mono, ...revealOf(opts)};
}

// `reveal` goes onto a band only when it was given, so a band built without it is byte-for-byte what it was.
const revealOf = (opts: {reveal?: number; until?: number}): {reveal?: number; until?: number} => ({...(opts.reveal === undefined ? {} : {reveal: opts.reveal}), ...(opts.until === undefined ? {} : {until: opts.until})});
// A constructor with no `reveal` (legend, spacer, raw, ...) refuses one instead of dropping it: the types already do, a JS caller is told here.
function assertNoReveal(opts: object | undefined, what: string): void {
  if (opts && (['reveal', 'until'] as const).some(k => k in opts && (opts as Record<string, unknown>)[k] !== undefined)) throw new Error(`${what}: takes no reveal — it is shown from the start (reveal goes on box, banner, stat, caption, group, row's children, table, sequence, swimlane, plane, bars and connect)`);
}

// group / table rows / sequence / swimlane lanes carry dark text (or white boxes) on their fill, which a solid fill would swallow:
// the types leave 'solid' / 'solid-danger' out (BoxTone), and this is the same rule for JS callers.
function assertBoxTone(tone: string | undefined, what: string): void {
  if (isSolidTone(tone)) throw new Error(`${what}: tone '${tone}' is for box() / banner() / stat() / a swimlane step / a legend item only — what sits on it would read dark on the fill; use 'accent' here`);
}

// `step`: a number/string drawn as a solid numbered badge over the title's
// own baseline (requires `title` — the badge has nothing to align to
// without it).
//
// Types: `step` requires `title`; `size` is one of FontSize (an integer >= 14); unknown keys are rejected; the
// literal `id` is remembered so connect() refs to it can be checked by add().
export function box<const Id extends string = never>(opts: BoxInput<Id>): BoxBand & Declares<Id> & HandleOf<Id>;
export function box(opts: BoxOpts): BoxBand {
  if (opts.size !== undefined) {
    assertFontSize(opts.size);
    warnBoxSizeOnce();
  }
  // the plain text (and spans) of every rich field go over the copied options: a band never holds an array
  const band = {type: 'box', ...opts, ...richBoxFields(opts)} as BoxBand;
  assertSolidText(band, 'box()');
  if (band.step != null && !band.title) throw new Error('box({step}) needs a title — the badge aligns to the title\'s first line');
  if (band.icon !== undefined && band.step != null) throw new Error('box({icon}) and box({step}) both sit at the box\'s left edge — use one');
  // the glyph is resolved here (the shell) and carried on the band, so emit stays free of I/O
  if (band.icon !== undefined) band.iconGlyph = resolveIcon(band.icon, 'box({icon})');
  if ((band.iconAt !== undefined || band.iconSize !== undefined) && band.icon === undefined) throw new Error('box({iconAt, iconSize}) needs an icon');
  if (band.iconAt !== undefined && band.iconAt !== 'left' && band.iconAt !== 'top') throw new Error(`box({iconAt}) is 'left' or 'top' (got ${JSON.stringify(band.iconAt)})`);
  return withHandle(band, opts.id);
}

function assertTextRole(role: string | undefined, allowed: readonly string[], what: string): void {
  if (role !== undefined && !allowed.includes(role)) throw new Error(`${what} must be ${allowed.map(r => `'${r}'`).join(' | ')} (got ${JSON.stringify(role)})`);
}

/**
 * The largest scale fill: true may try. 1.8 as ever, but an opted-in size (banner headlineRole, bars / plane labelRole)
 * is not scaled past OPT_IN_TEXT_MAX px: a 'display' headline stops at 1.28x, a 'stat' label (34px) never reaches it.
 * The usual roles (a stat({size: 'display'}) included) are not held back, so a diagram without these options scales as before.
 */
export function fillScaleLimit(bands: Band[]): number {
  const optIn = walkBands(bands).flatMap(b => b.type === 'banner' && b.headlineRole ? [ROLES[b.headlineRole]] : (b.type === 'bars' || b.type === 'plane') && b.labelRole ? [ROLES[b.labelRole]] : b.type === 'image' ? [b.labelRole, ...(b.marks ?? []).map(m => m.role), ...(b.labels ?? []).map(l => l.role)].flatMap(r => r ? [ROLES[r]] : []) : []);
  return Math.min(1.8, optIn.length ? OPT_IN_TEXT_MAX / Math.max(...optIn) : 1.8);
}

let boxSizeWarned = false;
/** box({size}) is read by neither layout nor emit; said once per process, and a later version throws. */
function warnBoxSizeOnce(): void {
  if (boxSizeWarned) return;
  boxSizeWarned = true;
  console.warn('svg-diagram: box({size}) は効果がない。大きい文字は role(stat() / display)を使う(次の版で throw する)');
}

/** A large, atomic value and its muted label. The result is an ordinary plain box, so it works in row(). */
export function stat<const Id extends string = never>(value: string | number, label: RichText, opts?: StatOpts & {id?: Id}): BoxBand & Declares<Id> & HandleOf<Id>;
export function stat(value: string | number, label: RichText, opts: StatOpts = {}): BoxBand {
  if (opts.size !== undefined && opts.size !== 'stat' && opts.size !== 'display') throw new Error(`stat(): size must be 'stat' or 'display' (got ${opts.size})`);
  const text = String(value);
  // 'solid' / 'solid-danger' fill the box (white text, so no tone of its own on the value or the label); any other tone colours the value
  const solid = opts.tone === 'solid' || opts.tone === 'solid-danger' ? opts.tone : undefined;
  const rich = richField(label, {field: 'stat() label', bold: false, tone: solid ? undefined : 'muted'});
  return withHandle({
    type: 'box', id: opts.id, ...(solid ? {tone: solid} : {}), flex: opts.flex, width: opts.width, col: opts.col, span: opts.span, ...revealOf(opts),
    align: 'center', lines: [
      {text, role: opts.size ?? 'stat', bold: true, tone: solid ? undefined : opts.tone as TextTone | undefined},
      {text: rich.text ?? '', ...(solid ? {} : {tone: 'muted' as const}), ...(rich.spans ? {spans: rich.spans} : {})},
    ], statValue: text,
  }, opts.id);
}

export function banner<const Id extends string = never>(opts: BannerOpts & {id?: Id}): BannerBand & Declares<Id> & HandleOf<Id>;
export function banner(opts: BannerOpts): BannerBand {
  assertTextRole(opts.headlineRole, HEADLINE_ROLES, 'banner() headlineRole');
  const headline = richField(opts.headline, {field: 'banner() headline', bold: true, tone: opts.headlineTone});
  const sub = richField(opts.sub, {field: 'banner() sub', bold: false, tone: opts.subTone ?? (isSolidTone(opts.tone) ? undefined : 'muted')});
  const text = {...(typeof opts.headline === 'string' ? {} : {headline: headline.text ?? ''}), ...(typeof opts.sub === 'string' || opts.sub === undefined ? {} : {sub: sub.text})};
  const spans = headline.spans || sub.spans ? {spans: {...(headline.spans ? {headline: headline.spans} : {}), ...(sub.spans ? {sub: sub.spans} : {})}} : {};
  const band = {type: 'banner', tone: opts.tone ?? 'accent', ...opts, ...text, ...spans} as BannerBand;
  assertSolidText(band, 'banner()');
  return withHandle(band, opts.id);
}

// A labelled frame around other bands (a network zone, a service boundary, a
// release phase). children: any bands (row, grid, box, nested group...).
// tone: 'muted' (default, grey fill) | 'accent' | 'plain' (white) | 'danger';
// dashed: draw the boundary dashed (default true for 'plain' = a trust/zone line).
// frame: false draws no frame and no title (pad 0): a bare container, e.g. to put a table / plane / banner in a row() without a doubled outline.
// Types: the ids (and connect() refs) of the children are exposed to add().
export function group<C extends Band | Band[], const Id extends string = never>(children: C, opts?: GroupOpts & {id?: Id}): GroupBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & HandleOf<Id>;
export function group(children: BandInput, opts: GroupOpts = {}): GroupBand {
  assertBoxTone(opts.tone, 'group()');
  const title = richField(opts.title, {field: 'group() title', bold: true, tone: opts.titleTone ?? (opts.tone === 'accent' ? 'accent' : 'text')});
  if (opts.frame === false && (title.text || opts.dashed || opts.tone)) throw new Error('group({frame: false}) draws no frame, so it takes no title, tone or dashed');
  return withHandle({type: 'group', children: [children].flat(), title: title.text, ...(title.spans ? {spans: {title: title.spans}} : {}), titleTone: opts.titleTone, titleAlign: opts.titleAlign, tone: opts.tone ?? 'muted', dashed: opts.dashed ?? (opts.tone === 'plain' ? true : undefined), pad: opts.pad ?? (opts.frame === false ? 0 : undefined), frame: opts.frame, stamp: opts.stamp, id: opts.id, flex: opts.flex, width: opts.width, span: opts.span, col: opts.col, ...revealOf(opts)}, opts.id);
}

// Key for line styles / tones used in the diagram. items:
//   {line: 'solid'|'dashed'|'dotted'|'double', arrow?: 'end'|'both'|'none', weight?: 'strong', label}
//   {tone: 'accent'|'muted'|'plain'|'danger'|'new'|'changed'|'removed', label}
export function legend(items: LegendItem[], opts: LegendOpts = {}): LegendBand {
  assertNoReveal(opts, 'legend()');
  for (const it of items) if (it.weight && it.line === 'double') throw new Error(`legend(): weight '${it.weight}' cannot go with line 'double' ("${it.label}")`);
  // a weight sample is a line sample: the plain line unless `line` says otherwise
  return {type: 'legend', items: items.map(it => it.weight && !it.line ? {...it, line: 'solid'} : it), align: opts.align ?? 'center'};
}

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
  return withHandle({type: 'table', columns, rows: rows as TableRow[], title: opts.title, header: opts.header, width: opts.width, tone: opts.tone, cellH: opts.cellH, headerH: opts.headerH, dense: opts.dense, rowHeader: opts.rowHeader, id: opts.id, ...revealOf(opts)}, opts.id);
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
//   opts.labelW: width of the lane-label column (default 128)
// Returns an array (the lane block followed by its flows); d.add() accepts it directly.
//
// Types: at most 6 lanes (rule swimlane-lanes); every step.lane is a declared lane id; step ids are unique; flows'
// from / to are step ids (optionally ':side[@t]'); chip / labelAt need a label. The step ids are exposed to add().
export function swimlane<
  const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [], const Id extends string = never,
>(lanes: L & LaneCheck<L>, steps: S & StepCheck<L, S>, opts?: Omit<SwimlaneOpts, 'flows' | 'id'> & {id?: Id; flows?: F & FlowCheck<StepIds<S>, F>}): (SwimlaneBand & Declares<StepIds<S> | Id> | ConnectBand)[] & AnchorsOf<StepIds<S> | Id>;
export function swimlane(lanes: SwimlaneLane[], steps: SwimlaneStep[], opts: SwimlaneOpts = {}): (SwimlaneBand | ConnectBand)[] {
  for (const l of lanes) assertBoxTone(l.tone, `swimlane() lane "${l.id}"`);
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
    return connectBand(from, to, {route: 'elbow', bend: f.bend ?? 'auto', bendOffset: f.bendOffset ?? 6 + (k % 3) * 7, label: f.label, chip: f.chip ?? !!f.label, labelAt: f.labelAt ?? 0.4, line: f.line, arrow: f.arrow, tone: f.tone}, false);
  });
  const block: SwimlaneBand = {type: 'swimlane', lanes, steps: placed, cols, phases: opts.phases, labelW: opts.labelW, colGap: opts.colGap, id: opts.id, ...revealOf(opts)};
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
  assertNoReveal(opts, 'wireframe()');
  const numbering = autoNumber(root, opts.overlays);
  return Object.defineProperty(withHandle({type: 'wireframe', root, ...opts}, opts.id), NUMBERING, {value: numbering});
}

// `n: true` (on a node, on a part in `parts: {...}`, or on a map marker) means "number me": such callouts get consecutive
// numbers in reading order (top to bottom, left to right), continuing after any explicit numbers.
interface Numbering {
  /** One per `n: true` found, in reading order: each writes the number it is given back into its callout. */
  todo: ((n: number) => void)[];
  /** The largest number written explicitly. */
  max: number;
}
const NUMBERING = Symbol('wireframe-numbering'); // on a wireframe band: its Numbering, so a diagram shell can number ITS callouts first
type NumberTrees = (WfRoot | WfOverlay | WfOverlay[] | undefined)[];
/** `skip`: nodes that are not walked (nor descended into) — used to number only a shell, not the content it wraps. */
function collectNumbering(skip: Set<object> | null, trees: NumberTrees): Numbering {
  const todo: Numbering['todo'] = [];
  let max = 0;
  const num = (v: unknown) => { if (typeof v === 'number') max = Math.max(max, v); };
  const walk = (nd: WfNode | WfNode[] | undefined | null): void => {
    if (!nd || typeof nd !== 'object') return;
    if (Array.isArray(nd)) return nd.forEach(c => walk(c));
    if (!nd.t || skip?.has(nd)) return;
    const node = nd;
    if (node.n === true) todo.push(v => { node.n = v; }); else num(node.n);
    const parts = node.parts;
    if (parts) for (const [k, v] of Object.entries(parts)) { if (v === true) todo.push(nv => { parts[k as WfPartKey] = nv; }); else num(v); }
    if (node.t === 'map') for (const m of node.markers ?? []) { if (m.n === true) todo.push(v => { m.n = v; }); else num(m.n); }
    walk('children' in node ? node.children : undefined);
  };
  trees.forEach(t => walk(t as WfNode | WfNode[] | undefined));
  return {todo, max};
}
const assignNumbers = (max: number, ...groups: Numbering['todo'][]): void => { let next = max + 1; for (const g of groups) for (const set of g) set(next++); };
function autoNumber(...trees: NumberTrees): Numbering {
  const nm = collectNumbering(null, trees);
  assignNumbers(nm.max, nm.todo);
  return nm;
}
/** Every node of a tree (so a shell can tell its own nodes from the content's). */
function nodesOf(root: WfRoot): Set<object> {
  const out = new Set<object>();
  const walk = (nd: unknown): void => {
    if (!nd || typeof nd !== 'object') return;
    if (Array.isArray(nd)) return nd.forEach(walk);
    out.add(nd);
    walk((nd as {children?: unknown}).children);
  };
  walk(root);
  return out;
}

// Several screens as thumbnails in a grid — a screen-transition diagram. Join them with connect().
//   items: [{id, title, tag?, root, h?, skeleton?, at?: [row, col]}]   opts: {cols (3), gap (64), rowGap (56), h (320), skeleton}
//   at places an item explicitly; col may be fractional (0.5 = half a column in) to centre a parent over its children.
// Types: item ids are exposed to add() as connect() anchors; `at` is a [row, col] tuple.
export function screens<const Id extends string = never>(items: ScreensItemInput<Id>[], opts?: ScreensOpts): ScreensBand & Declares<Id> & AnchorsOf<Id>;
export function screens(items: ScreensItem[], opts: ScreensOpts = {}): ScreensBand {
  assertNoReveal(opts, 'screens()');
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

export function spacer(h: number, opts?: {reveal?: number}): SpacerBand {
  assertNoReveal(opts, 'spacer()');
  return {type: 'spacer', h};
}

// 'row#5' (the 5th column / child of the row with this id) and 'row#5-6' (columns 5..6): the ids layout.ts registers for a row({id}).
function columnId(id: string, n: number, to?: number): string {
  if (!Number.isInteger(n) || n < 1 || (to !== undefined && (!Number.isInteger(to) || to < n))) throw new Error(`row "${id}": col(${n}${to === undefined ? '' : `, ${to}`}) needs whole numbers, 1-based and in order`);
  return to === undefined || to === n ? `${id}#${n}` : `${id}#${n}-${to}`;
}

function assertRowChildren(children: readonly {type?: string}[]): void {
  children.forEach((c, i) => {
    if (c?.type !== 'box' && c?.type !== 'group') throw new Error(`row(): child ${i} is ${c?.type === undefined ? 'not a band' : `a ${c.type}()`}, but row() takes box() and group() children only`);
  });
}

// row()/grid() lay out boxes only. A group (or anything else) would silently render as an empty
// little box in plain JS (.mjs), where the types do not stop it, so fail loudly instead.
function assertBoxChildren(what: 'row' | 'grid', children: readonly {type?: string}[]): void {
  children.forEach((c, i) => {
    if (c?.type !== 'box') throw new Error(`${what}(): child ${i} is ${c?.type === undefined ? 'not a band' : `a ${c.type}()`}, but ${what}() takes box() children only. Stack groups vertically with d.add(group(...), group(...)) instead of placing them in a ${what}`);
  });
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
//
// Groups may sit in a row too (side-by-side frames: Host | Cloud, or two containers next to each other). Their
// frames are stretched to the tallest one; give a group `flex` / `width` / `span` / `col` like a box. Groups
// in a row cannot be combined with `arrows: 'between'`.
export function row<C extends BoxBand, const Id extends string = never>(children: C[], opts?: RowOpts & {id?: Id}): RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>;
export function row<C extends BoxBand | GroupBand, const Id extends string = never>(children: C[], opts?: RowOpts & {id?: Id}): GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>;
export function row(children: (BoxBand | GroupBand)[], opts: RowOpts = {}): RowBand | GroupRowBand {
  assertNoReveal(opts, 'row()'); // a row is shown with its children: give each child its own reveal
  const hasGroup = children.some(c => c?.type === 'group');
  if (hasGroup) {
    if (opts.arrows === 'between') throw new Error("row(): arrows: 'between' cannot be used when a child is a group()");
    assertRowChildren(children);
  } else assertBoxChildren('row', children as BoxBand[]);
  const {cols, kids} = spanRow(children, opts.cols);
  const band = hasGroup
    ? {type: 'grouprow' as const, id: opts.id, cols, children: kids, gap: opts.gap ?? 16, justify: opts.justify ?? 'stretch', itemWidth: opts.width}
    : {type: 'row' as const, id: opts.id, cols, children: kids as BoxBand[], gap: opts.gap ?? 16, arrows: opts.arrows ?? 'none', justify: opts.justify ?? 'stretch', itemWidth: opts.width};
  if (!opts.id) return band;
  const id = opts.id;
  return Object.defineProperty(withHandle(band, id), 'col', {value: (n: number, to?: number) => {
    const slot = columnId(id, n, to);
    return Object.defineProperties({id: slot}, handleFor(slot));
  }});
}

// row({cols: [6, 6]}): one span per child, so the column count is their sum and no child carries `span` / `col`.
// The children are copied with their span filled in (a child that also sets `span` / `col` is a contradiction, so it throws).
function spanRow<C extends BoxBand | GroupBand>(children: C[], cols: number | number[] | undefined): {cols: number | undefined; kids: C[]} {
  if (!Array.isArray(cols)) return {cols, kids: children};
  if (cols.length !== children.length) throw new Error(`row({cols: [${cols.join(', ')}]}) declares ${cols.length} spans for ${children.length} children`);
  if (cols.some(n => !Number.isInteger(n) || n < 1)) throw new Error(`row({cols: [${cols.join(', ')}]}): every span must be a whole number >= 1`);
  const kids = children.map((c, i) => {
    if (c.span !== undefined || c.col !== undefined) throw new Error(`row({cols: [...]}): child ${i} has its own span / col, but the row already gives it span ${cols[i]}`);
    return Object.assign(Object.create(Object.getPrototypeOf(c), Object.getOwnPropertyDescriptors(c)) as C, {span: cols[i]});
  });
  return {cols: cols.reduce((a, b) => a + b, 0), kids};
}

/** One cell of iconRow(): the icon, the label beside it, and optionally a line of body. */
export interface IconRowItem {icon: IconName; label: string; body?: string; tone?: BoxTone; iconTone?: TextTone}

/** One node of an architecture diagram: an icon, centred and large, with its label under it (Visio's "shape"). */
export interface NodeOpts {
  icon: IconName;
  label: string;
  /** a second, muted line under the label (a type, an address) */
  sub?: string;
  /** side of the icon in px (default 48) */
  size?: number;
  /** `true` draws the box around it (default: no box) */
  frame?: boolean;
  tone?: BoxTone;
  iconTone?: TextTone;
  tag?: string;
  tagTone?: import('./types.ts').TagTone;
  flex?: number;
  width?: number;
  col?: number;
  span?: number;
}
/**
 * A node: `box({icon, iconAt: 'top', title: label, body: sub, frame})`, centred. Put nodes in row() / grid(), inside group() for a
 * network / VPC / region boundary, and join them with connect() by id.
 */
export function node<const Id extends string = never>(opts: NodeOpts & {id?: Id}): BoxBand & Declares<Id> & HandleOf<Id>;
export function node(opts: NodeOpts & {id?: string}): BoxBand {
  const {label, sub, size, frame, ...rest} = opts;
  if (size !== undefined && !(size >= 16 && size <= 96)) throw new Error(`node(): size must be between 16 and 96 px (got ${size})`);
  return box({...rest, title: label, ...(sub !== undefined ? {body: sub} : {}), iconAt: 'top', ...(size !== undefined ? {iconSize: size} : {}), ...(frame ? {} : {frame: false as const}), align: 'center'} as never) as BoxBand;
}

/** A row of icon + label boxes (each a plain box({icon, title})). The label is required: an icon alone does not say what it means. */
export function iconRow(items: IconRowItem[], opts: RowOpts = {}): RowBand {
  if (items.length === 0) throw new Error('iconRow(): needs at least one item');
  return row(items.map(it => box({icon: it.icon, title: it.label, body: it.body, tone: it.tone, iconTone: it.iconTone})), opts);
}

// children: box() descriptors, laid out in `cols` columns (wraps to
// additional rows automatically). Every cell in the same grid-row shares
// that row's tallest cell's height, same as row().
export function grid<C extends BoxBand>(children: C[], opts: GridOpts): GridBand & Declares<IdsOf<C>>;
export function grid(children: BoxBand[], opts: GridOpts): GridBand {
  if (!opts?.cols) throw new Error('grid(children, {cols}) needs cols');
  assertNoReveal(opts, 'grid()');
  assertBoxChildren('grid', children);
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

// A band copied with the same properties (including the non-enumerable handles) so a diagram's defaults never change the
// object the caller holds — the same band can be added to another diagram with other defaults (or none).
function cloneBand<T extends object>(b: T): T {
  return Object.create(Object.getPrototypeOf(b), Object.getOwnPropertyDescriptors(b)) as T;
}
/** Maps a band list; a container is copied only when something inside it changed. */
function mapBands(bands: Band[], fn: (b: Band) => Band | undefined): Band[] {
  return bands.map(b => {
    const changed = fn(b);
    if (changed) return changed;
    if ('children' in b && Array.isArray(b.children)) {
      const kids = mapBands(b.children as Band[], fn);
      if (kids.some((k, i) => k !== (b.children as Band[])[i])) return Object.assign(cloneBand(b), {children: kids});
    }
    return b;
  });
}

// diagram({wireframeDefaults}): fill the screen fields a wireframe() / screens() item leaves out, and wrap its content in the shell.
// The result is a copy; a copy made here is never wrapped again (adding it to a diagram a second time is safe). `n: true` callouts
// of the shell are numbered BEFORE the content's auto-numbered ones (the shell is on top of the screen); that renumbers the
// content's auto numbers, which are written into the content nodes themselves — only when the shell has such callouts.
const SHELLED = new WeakSet<object>();
function applyWireframeDefaults(bands: Band[], defaults: WireframeDefaults): Band[] {
  const apply = <S extends WfScreen & {id?: string}>(orig: S, numbering?: Numbering): S => {
    if (SHELLED.has(orig)) return orig;
    const screen = cloneBand(orig);
    SHELLED.add(screen);
    const s = screen as unknown as Record<string, unknown>;
    for (const k of ['h', 'frame', 'skeleton', 'tag', 'tagTone'] as const) if (s[k] === undefined && defaults[k] !== undefined) s[k] = defaults[k];
    if (screen.shell === false) return screen;
    const props: WfShellProps = screen.shell ?? {};
    const own = nodesOf(orig.root);
    let content = [orig.root].flat() as WfNode[];
    if (defaults.appbar) {
      const {title, nav, right} = defaults.appbar;
      let active: number | undefined;
      if (typeof props.active === 'string') {
        active = (nav ?? []).indexOf(props.active);
        if (active < 0) throw new Error(`wireframeDefaults.appbar: "${props.active}" is not one of the nav items (${(nav ?? []).join(', ')})`);
      } else active = props.active;
      content = [wf.appbar(props.title ?? title, {nav, right, active}), ...content];
    }
    if (defaults.shell) content = [defaults.shell(content, props)].flat() as WfNode[];
    screen.root = content.length === 1 ? content[0] : content;
    if (numbering) {
      const shellNumbers = collectNumbering(own, [screen.root]);
      if (shellNumbers.todo.length) assignNumbers(Math.max(numbering.max, shellNumbers.max), shellNumbers.todo, numbering.todo);
    } else autoNumber(screen.root, screen.overlays);
    return screen;
  };
  return mapBands(bands, b => {
    if (b.type === 'wireframe') return apply(b as WireframeBand, (b as unknown as {[NUMBERING]?: Numbering})[NUMBERING]);
    if (b.type === 'screens') {
      const sc = b as ScreensBand, items = sc.items.map(it => apply(it));
      return items.some((it, i) => it !== sc.items[i]) ? Object.assign(cloneBand(sc), {items}) : undefined;
    }
    return undefined;
  });
}

// The options a connector was written with, kept (non-enumerable) so diagram({connectDefaults}) can tell "not given" from "given as the default".
// Only connect() and branch() keep them: swimlane() flows are not connectors the user wrote, so the defaults do not touch them.
const GIVEN = Symbol('connect-options');
function applyConnectDefaults(bands: Band[], defaults: ConnectDefaults): Band[] {
  return mapBands(bands, b => {
    if (b.type !== 'connect') return undefined;
    const given = (b as ConnectBand & {[GIVEN]?: ConnectOpts})[GIVEN];
    if (!given) return undefined;
    const own = Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)) as ConnectOpts;
    const merged: ConnectOpts = {...defaults, ...own};
    if (own.marker !== undefined) merged.arrow = own.arrow; // the legacy spellings of arrow / line outrank the default
    if (own.dashed !== undefined) merged.line = own.line;
    if (!own.label) merged.chip = own.chip;                  // a chip needs a label
    const route = merged.route ?? 'straight';
    if (route !== 'elbow') { merged.bend = own.bend; merged.bendOffset = own.bendOffset; }
    if (route !== 'loop-under') merged.dip = own.dip;
    return connectBand(b.from, b.to, merged);
  });
}

function connectBand(from: string, to: string, opts: ConnectOpts, trackGiven = true): ConnectBand {
  // arrow: 'end' (default) | 'both' | 'start' | 'none'  (legacy `marker: false` = 'none')
  // line:  'solid' (default) | 'dashed' | 'dotted' | 'double'  (legacy `dashed: true` = 'dashed')
  // weight: 'strong' = a thick line with its own arrowhead (not with 'double')
  // labelAt: 0..1 along a straight/loop-under connector where the label/chip sits (default 0.5)
  // chip:  true puts the label in a bordered pill sitting ON the line (protocol / rate tags)
  const arrow = opts.arrow ?? (opts.marker === false ? 'none' : 'end');
  const line = opts.line ?? (opts.dashed ? 'dashed' : 'solid');
  // weight: 'strong' = a thick line (a name for the meaning, not a px); 'double' already reads as a thick line, so the two cannot be combined
  if (opts.weight && line === 'double') throw new Error(`connect(${from} -> ${to}): weight '${opts.weight}' cannot go with line 'double' (both mean a thick line)`);
  const band: ConnectBand = {type: 'connect', from, to, route: opts.route ?? 'straight', dip: opts.dip ?? 32, bend: opts.bend ?? 0.5, bendOffset: opts.bendOffset, arrow, line, ...(opts.weight ? {weight: opts.weight} : {}), chip: !!opts.chip, labelAt: opts.labelAt ?? 0.5, tone: opts.tone, label: opts.label, ...revealOf(opts)};
  return trackGiven ? Object.defineProperty(band, GIVEN, {value: opts, configurable: true}) : band;
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
  assertNoReveal(opts, 'pyramid()');
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
  assertNoReveal(opts, 'curve()');
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

// A coordinate plane: axes with ticks, points, guide lines, dimension lines and labels, all in the plane's own units.
//   plane({x: {label: 'x', max: 100, step: 20}, y: {label: 'y', max: 60}, yDown?: true (image coordinates), grid?: true,
//          points: [{id: 'a', at: [20, 10], label: 'A', labelAt?, tone?, shape?: 'dot' | 'ring' | 'cross'}],
//          lines:  [{from: 'a', to: [20, 0], tone?, dashed? (default true), arrow?}],       // guides / projections
//          dims:   [{from: 'a', to: 'b', label: '40 m', side?: 'above' | 'below' | 'left' | 'right', tone?}],
//          labels: [{at: [50, 55], text: '原点', anchor?, tone?, bold?}], height?, width?})
// A position is [x, y] or the id of a point. Layout places the ticks, labels and dimension lines; verify reports labels that
// overlap each other or leave the figure.
export function plane<const Id extends string = never>(opts: PlaneOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function plane(opts: PlaneOpts): PlaneBand {
  assertTextRole(opts?.labelRole, LABEL_ROLES, 'plane() labelRole');
  for (const k of ['x', 'y'] as const) {
    const a = opts?.[k];
    if (a && a.step !== undefined && !(a.step > 0 && Number.isFinite(a.step))) throw new Error(`plane(): axis ${k} step must be a number > 0 (got ${a.step})`);
    if (!a || typeof a.max !== 'number') throw new Error(`plane(): "${k}" needs an axis, e.g. {max: 100}`);
    if (a.max <= (a.min ?? 0)) throw new Error(`plane(): axis ${k} needs max > min`);
  }
  return withHandle({type: 'plane', ...opts, height: opts.height ?? 300}, opts.id);
}

// N person icons in a grid, the first `count` emphasized — "76 of 100 people". The others are outlines, so the count reads
// without colour. Pass the total and the count; the grid fills row by row from the top left. No text of its own: put the
// number beside it with stat() / caption().
//   people(100, 76)                       // 10 x 10
//   people(10, 3, {cols: 5, tone: 'danger'})
//   people(100, [35, 47], {tone: 'accent', tone2: 'danger'})  // 35 in tone, the next 47 in tone2, the rest outlines
export function people<const Id extends string = never>(total: number, count: number | readonly [number, number], opts?: PeopleOpts & {id?: Id}): PeopleBand & Declares<Id> & HandleOf<Id>;
export function people(total: number, countIn: number | readonly [number, number], opts: PeopleOpts = {}): PeopleBand {
  assertNoReveal(opts, 'people()');
  if (!Number.isInteger(total) || total < 1 || total > 400) throw new Error(`people(): total must be a whole number from 1 to 400 (got ${total})`);
  const [count, count2] = typeof countIn === 'number' ? [countIn, 0] : countIn;
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(count2) || count2 < 0 || count + count2 > total) throw new Error(`people(): count must be a whole number from 0 to total (${total}), or [k1, k2] with k1 + k2 <= total (got ${JSON.stringify(countIn)})`);
  const cols = opts.cols ?? (total <= 10 ? total : Math.ceil(Math.sqrt(total)));
  if (!Number.isInteger(cols) || cols < 1 || cols > total) throw new Error(`people(): cols must be a whole number from 1 to total (got ${cols})`);
  const size = opts.size ?? 28, gap = opts.gap ?? 8;
  if (!(size >= 12 && size <= 96)) throw new Error(`people(): size must be from 12 to 96 px (got ${size})`);
  if (!(gap >= 0)) throw new Error(`people(): gap must be >= 0 (got ${gap})`);
  if (opts.align !== undefined && opts.align !== 'left' && opts.align !== 'center') throw new Error(`people(): align must be 'left' or 'center' (got ${opts.align})`);
  for (const k of ['tone', 'tone2', 'rest'] as const) if (opts[k] !== undefined && !['accent', 'danger', 'muted'].includes(opts[k]!)) throw new Error(`people(): ${k} must be 'accent', 'danger' or 'muted' (got ${opts[k]})`);
  if (opts.side !== undefined) {
    if (typeof opts.side.value !== 'string' || !opts.side.value) throw new Error('people(): side needs a value (the text beside the grid)');
    if (opts.side.size !== undefined && opts.side.size !== 'stat' && opts.side.size !== 'display') throw new Error(`people(): side.size must be 'stat' or 'display' (got ${opts.side.size})`);
    if (opts.side.tone !== undefined && !['accent', 'danger', 'muted'].includes(opts.side.tone)) throw new Error(`people(): side.tone must be 'accent', 'danger' or 'muted' (got ${opts.side.tone})`);
  }
  return withHandle({type: 'people', total, count, cols, size, gap, align: opts.align ?? 'center', tone: opts.tone ?? 'accent', tone2: opts.tone2 ?? ((opts.tone ?? 'accent') === 'danger' ? 'accent' : 'danger'), count2, rest: opts.rest ?? 'muted', ...(opts.side ? {side: opts.side} : {}), alt: opts.alt ?? (count2 ? `${count} + ${count2} / ${total}` : `${count} / ${total}`), ...(opts.id === undefined ? {} : {id: opts.id})}, opts.id);
}

// Dots along a lane (an axis): each value is a dot at its position, dots that would touch pile up (the piles never overlap).
// `zones` mark spans of the lane — a bar on the lane, a label under it, and the tone of the dots inside it — for "the people who
// cannot keep up". Values are in the lane's own units (min .. max, default 0 .. 1).
//   dots([0.1, 0.12, 0.15, 0.5, 0.8], {zones: [{from: 0, to: 0.3, label: 'ついてこれない人'}], lowLabel: '遅い', highLabel: '速い'})
export function dots<const Id extends string = never>(values: readonly DotDatum[], opts?: DotsOpts & {id?: Id}): DotsBand & Declares<Id> & HandleOf<Id>;
export function dots(values: readonly DotDatum[], opts: DotsOpts = {}): DotsBand {
  assertNoReveal(opts, 'dots()');
  if (!Array.isArray(values) || values.length === 0) throw new Error('dots(values) needs at least one value');
  const min = opts.min ?? 0, max = opts.max ?? 1, r = opts.r ?? 10, TONES = ['accent', 'danger', 'muted'];
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) throw new Error(`dots(): needs finite min < max (got ${min} .. ${max})`);
  if (!(r >= 2 && r <= 24)) throw new Error(`dots(): r must be from 2 to 24 px (got ${r})`);
  for (const k of ['width', 'height'] as const) if (opts[k] !== undefined && !(opts[k]! > 0 && Number.isFinite(opts[k]))) throw new Error(`dots(): ${k} must be a finite number > 0 (got ${opts[k]})`);
  const list = values.map(v => typeof v === 'number' ? {at: v} : v);
  for (const v of list) {
    if (!Number.isFinite(v.at)) throw new Error(`dots(): a value must be a finite number (got ${v.at})`);
    if (v.at < min || v.at > max) throw new Error(`dots(): ${v.at} is outside the lane (${min} .. ${max})`);
    if ('tone' in v && v.tone !== undefined && !TONES.includes(v.tone)) throw new Error(`dots(): tone must be accent, danger or muted (got ${v.tone})`);
  }
  const zones = (opts.zones ?? []).map(z => ({tone: 'danger' as const, ...z}));
  zones.forEach((z, i) => {
    if (!(z.from >= min && z.to <= max && z.from < z.to)) throw new Error(`dots(): zone "${z.label}" must satisfy ${min} <= from < to <= ${max}`);
    if (!TONES.includes(z.tone)) throw new Error(`dots(): zone tone must be accent, danger or muted (got ${z.tone})`);
    if (!z.label) throw new Error('dots(): a zone needs a label — the colour alone does not say what it marks');
    for (const o of zones.slice(0, i)) if (z.from < o.to && o.from < z.to) throw new Error(`dots(): zones "${o.label}" and "${z.label}" overlap`);
  });
  return withHandle({type: 'dots', dots: list, min, max, lowLabel: opts.lowLabel, highLabel: opts.highLabel, zones, r, width: opts.width, height: opts.height, alt: opts.alt ?? `${list.length} dots`, ...(opts.id === undefined ? {} : {id: opts.id})}, opts.id);
}

type BarIds<D extends readonly BarDatum[]> = Extract<D[number]['id'], string>;
export function bars<const D extends readonly BarDatum[], const Id extends string = never>(data: D, opts?: BarsOpts & {id?: Id}): BarsBand & Declares<Id | BarIds<D>> & HandleOf<Id> & AnchorsOf<BarIds<D>>;
export function bars(data: readonly BarDatum[], opts: BarsOpts = {}): BarsBand {
  assertTextRole(opts.labelRole, LABEL_ROLES, 'bars() labelRole');
  if (!Array.isArray(data) || data.length === 0) throw new Error('bars(data) needs at least one value');
  if (opts.height !== undefined && (!(opts.height > 0) || !Number.isFinite(opts.height))) throw new Error(`bars(): height must be a finite number > 0 (got ${opts.height})`);
  for (const d of data) {
    if (!Number.isFinite(d.value)) throw new Error(`bars(): value for "${d.label}" must be finite (got ${d.value})`);
    if (d.value < 0) throw new Error(`bars(): value for "${d.label}" must be >= 0 (got ${d.value})`);
    if (d.series !== undefined && !['a', 'b', 'c'].includes(d.series)) throw new Error(`bars(): series for "${d.label}" must be a, b, or c (got ${d.series})`);
    if (d.tone !== undefined && !['accent', 'danger', 'muted'].includes(d.tone)) throw new Error(`bars(): tone for "${d.label}" must be accent, danger, or muted (got ${d.tone})`);
    if (d.tone !== undefined && d.series !== undefined) throw new Error(`bars(): "${d.label}" has both series and tone; use one`);
  }
  if (opts.dir !== undefined && opts.dir !== 'h' && opts.dir !== 'v') throw new Error(`bars(): dir must be 'h' or 'v' (got ${opts.dir})`);
  if (data.every(d => d.value === 0)) throw new Error('bars(): all values are 0');
  if (opts.labels !== undefined && !['all', 'category', 'none'].includes(opts.labels)) throw new Error(`bars(): labels must be 'all', 'category' or 'none' (got ${opts.labels})`);
  for (const k of ['axis', 'grid', 'baseline'] as const) if (opts[k] !== undefined && typeof opts[k] !== 'boolean') throw new Error(`bars(): ${k} must be true or false (got ${opts[k]})`);
  if (opts.axis === false && opts.grid === true) throw new Error('bars(): grid needs axis (axis: false removes the ticks the grid lines belong to)');
  if (opts.barRatio !== undefined && !(opts.barRatio > 0 && opts.barRatio <= 1)) throw new Error(`bars(): barRatio must be a number > 0 and <= 1 (got ${opts.barRatio})`);
  if (opts.barRatio !== undefined && opts.stack) throw new Error('bars(): barRatio does not apply to stack');
  const stack = !!opts.stack;
  const extent = stack ? data.reduce((n, d) => n + d.value, 0) : Math.max(...data.map(d => d.value));
  const max = opts.max ?? extent;
  if (!(max > 0) || !Number.isFinite(max)) throw new Error(`bars(): max must be a finite number > 0 (got ${max})`);
  if (extent > max) throw new Error(`bars(): ${stack ? 'stack total' : 'a value'} (${extent}) exceeds max (${max})`);
  const ids = data.map(d => d.id).filter((id): id is string => !!id);
  if (new Set(ids).size !== ids.length) throw new Error('bars(): each id must be unique');
  if (opts.id !== undefined && ids.includes(opts.id)) throw new Error(`bars(): the band's id "${opts.id}" is also a bar's id — each id must be unique`);
  const band: BarsBand = {type: 'bars', data: [...data], max, unit: opts.unit, dir: opts.dir ?? 'h', stack, height: opts.height, ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)};
  for (const k of ['labels', 'axis', 'grid', 'baseline', 'barRatio', 'labelRole'] as const) if (opts[k] !== undefined) Object.assign(band, {[k]: opts[k]});
  return withHandle(withAnchors(band, data.map(d => d.id)), opts.id);
}

type MarkIds<M extends readonly ImageMark[]> = Extract<M[number]['id'], string>;
const IMAGE_TONES = ['plain', 'accent', 'danger', 'muted', 'new', 'changed', 'removed', 'solid', 'solid-danger'];
/**
 * A picture (PNG / JPEG / GIF / WebP) as a part, read now and embedded as a data URI so the SVG stays one file. `marks` outline regions
 * (spotlight and connect() can point at their ids); `labels` put words on opaque plates. Positions are fractions of the picture.
 * `src`: a path (relative: next to the diagram source), `new URL('./a.png', import.meta.url)`, or a data URI.
 */
export function image<const M extends readonly ImageMark[] = [], const Id extends string = never, C extends Band | Band[] = []>(src: string | URL, opts: Omit<ImageOpts, 'over'> & {id?: Id; marks?: M; over?: C}): ImageBand & Declares<Id | MarkIds<M> | IdsOf<C>> & Refers<RefsOf<C>> & HandleOf<Id> & AnchorsOf<MarkIds<M>>;
export function image(src: string | URL, opts: ImageOpts = {}): ImageBand {
  if (opts.pad !== undefined && !(opts.pad >= 0 && Number.isFinite(opts.pad))) throw new Error(`image(): pad must be a finite number >= 0 (got ${opts.pad})`);
  const over = opts.over === undefined ? [] : [opts.over].flat() as Band[];
  for (const [i, c] of over.entries()) if (c?.type === 'connect') throw new Error(`image(): over[${i}] is a connect() — add connectors at the top level of the diagram (they may point at ids inside the picture)`);
  if (!opts.alt?.trim() && !opts.decorative) throw new Error('image(): alt is required (what the picture shows) — or pass decorative: true when it adds nothing');
  if (opts.alt && opts.decorative) throw new Error('image(): alt and decorative: true contradict each other');
  for (const k of ['width', 'height'] as const) if (opts[k] !== undefined && (!(opts[k]! > 0) || !Number.isFinite(opts[k]))) throw new Error(`image(): ${k} must be a finite number > 0 (got ${opts[k]})`);
  if (opts.width !== undefined && opts.height !== undefined) throw new Error('image(): give width or height, not both (the other follows the picture\'s aspect ratio)');
  assertTextRole(opts.labelRole, LABEL_ROLES, 'image() labelRole');
  if (opts.align !== undefined && !['left', 'center', 'right'].includes(opts.align)) throw new Error(`image(): align must be 'left', 'center' or 'right' (got ${opts.align})`);
  const unit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
  const tone = (t: string | undefined, where: string) => { if (t !== undefined && !IMAGE_TONES.includes(t)) throw new Error(`image(): ${where} tone "${t}" is not one of ${IMAGE_TONES.join(', ')}`); };
  (opts.marks ?? []).forEach((m, i) => {
    const [x, y, w, h] = m.rect ?? [];
    if (![x, y, w, h].every(n => typeof n === 'number' && unit(n)) || !(w > 0 && h > 0) || x + w > 1.0001 || y + h > 1.0001) throw new Error(`image(): mark ${i + 1} rect must be [x, y, w, h] as fractions of the picture, inside it (got ${JSON.stringify(m.rect)})`);
    tone(m.tone, `mark ${i + 1}`);
    assertTextRole(m.role, LABEL_ROLES, `image() mark ${i + 1} role`);
    if (m.label !== undefined && !m.label.trim()) throw new Error(`image(): mark ${i + 1} label is empty`);
  });
  (opts.labels ?? []).forEach((l, i) => {
    if (!l.text?.trim()) throw new Error(`image(): label ${i + 1} has no text`);
    if (!Array.isArray(l.at) || l.at.length !== 2 || !l.at.every(unit)) throw new Error(`image(): label ${i + 1} "at" must be [x, y] as fractions of the picture (0 to 1) (got ${JSON.stringify(l.at)})`);
    if (l.anchor !== undefined && !['start', 'middle', 'end'].includes(l.anchor)) throw new Error(`image(): label ${i + 1} anchor must be 'start', 'middle' or 'end' (got ${l.anchor})`);
    tone(l.tone, `label ${i + 1}`);
    assertTextRole(l.role, LABEL_ROLES, `image() label ${i + 1} role`);
  });
  const ids = (opts.marks ?? []).map(m => m.id).filter((id): id is string => !!id);
  if (new Set(ids).size !== ids.length) throw new Error('image(): each mark id must be unique');
  if (opts.id !== undefined && ids.includes(opts.id)) throw new Error(`image(): the band's id "${opts.id}" is also a mark's id — each id must be unique`);
  const file = readImage(src);
  const band: ImageBand = {
    type: 'image', href: file.href, naturalW: file.w, naturalH: file.h, bytes: file.bytes, alt: opts.alt?.trim() ?? '',
    ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts),
    ...(opts.width === undefined ? {} : {width: opts.width}), ...(opts.height === undefined ? {} : {height: opts.height}), ...(opts.align === undefined ? {} : {align: opts.align}), ...(opts.labelRole === undefined ? {} : {labelRole: opts.labelRole}),
    ...(opts.marks?.length ? {marks: opts.marks.map(m => ({...m, rect: [...m.rect] as unknown as ImageRect}))} : {}),
    ...(opts.labels?.length ? {labels: opts.labels.map(l => ({...l}))} : {}),
    ...(over.length ? {children: over} : {}), ...(opts.pad === undefined ? {} : {pad: opts.pad}),
  };
  return withHandle(withAnchors(band, (opts.marks ?? []).map(m => m.id)), opts.id);
}

/** The ids of a tree's nodes (its own, and every descendant's). */
type TreeIds<T> = (T extends {readonly id: infer I extends string} ? I : never) | (T extends {readonly children: readonly (infer C)[]} ? TreeIds<C> : never);

/**
 * An org chart / hierarchy: the nodes place themselves (parent centred over its children, levels aligned). A node is
 * {label, sub?, id?, tone?, children?}; one with an id is an anchor for connect(), also as `t.anchors.<id>`.
 *   tree({label: '社長', sub: '代表取締役', children: [{label: '開発部', id: 'dev', children: [...]}, {label: '営業部'}]}, {dir: 'down'})
 */
export function tree<const R extends TreeItem, const Id extends string = never>(root: R, opts?: TreeOpts & {id?: Id}): TreeBand & Declares<Id | TreeIds<R>> & HandleOf<Id> & AnchorsOf<TreeIds<R>>;
export function tree(root: TreeItem, opts: TreeOpts = {}): TreeBand {
  if (!root || typeof root !== 'object' || typeof root.label !== 'string') throw new Error('tree(root) needs a root node: {label: "...", children: [...]}');
  if (opts.dir !== undefined && opts.dir !== 'down' && opts.dir !== 'right') throw new Error(`tree(): dir must be 'down' or 'right' (got ${String(opts.dir)})`);
  if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 80 && Number.isFinite(opts.maxNodeW))) throw new Error(`tree(): maxNodeW must be a number >= 80 (got ${opts.maxNodeW})`);
  const ids: (string | undefined)[] = [];
  const walk = (n: TreeItem): void => {
    if (n.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(n.tone)) throw new Error(`tree(): "${n.label}" has tone ${String(n.tone)}`);
    ids.push(n.id);
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  const band: TreeBand = {type: 'tree', root, ...(opts.dir === undefined ? {} : {dir: opts.dir}), ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), ids);
}

type StateIds<S extends readonly StateItem[]> = Extract<S[number]['id'], string>;

/**
 * A state diagram: states (boxes) and transitions (arrows) that place themselves in layers, flowing left to right
 * (dir: 'down' for top to bottom). A transition that goes back, skips a state or loops on itself is routed around the others.
 *   stateDiagram([{id: 'idle', label: '待機'}, {id: 'run', label: '実行中'}, {id: 'done', label: '完了', final: true}],
 *                [{from: 'idle', to: 'run', label: '開始'}, {from: 'run', to: 'idle', label: '中止'}, {from: 'run', to: 'done'}], {initial: 'idle'})
 */
export function stateDiagram<const S extends readonly StateItem[], const Id extends string = never>(states: S, transitions: readonly Transition[], opts?: StatesOpts & {id?: Id}): StatesBand & Declares<Id | StateIds<S>> & HandleOf<Id> & AnchorsOf<StateIds<S>>;
export function stateDiagram(states: readonly StateItem[], transitions: readonly Transition[], opts: StatesOpts = {}): StatesBand {
  if (!Array.isArray(states) || states.length === 0) throw new Error('stateDiagram(states, transitions) needs at least one state');
  if (opts.dir !== undefined && opts.dir !== 'right' && opts.dir !== 'down') throw new Error(`stateDiagram(): dir must be 'right' or 'down' (got ${String(opts.dir)})`);
  if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 80 && Number.isFinite(opts.maxNodeW))) throw new Error(`stateDiagram(): maxNodeW must be a number >= 80 (got ${opts.maxNodeW})`);
  for (const t of transitions) if (t.line !== undefined && !['solid', 'dashed', 'dotted'].includes(t.line)) throw new Error(`stateDiagram(): transition ${t.from} -> ${t.to} has line ${String(t.line)}`);
  for (const s of states) if (s.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(s.tone)) throw new Error(`stateDiagram(): state "${s.id}" has tone ${String(s.tone)}`);
  const band: StatesBand = {type: 'states', states: [...states], transitions: [...transitions], ...(opts.dir === undefined ? {} : {dir: opts.dir}), ...(opts.initial === undefined ? {} : {initial: opts.initial}), ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), states.map(s => s.id));
}

/**
 * A mind map: the root in the middle, its children split to the right and the left (balanced by height, in the order
 * written: the right side first), each branch growing outward. Nodes are the same as tree()'s; `sides` pins a child of the root.
 *   mindmap({label: '新機能', children: [{label: '目的', children: [...]}, {label: '課題', id: 'issues'}]}, {sides: {issues: 'left'}})
 */
export function mindmap<const R extends TreeItem, const Id extends string = never>(root: R, opts?: MindmapOpts & {id?: Id}): TreeBand & Declares<Id | TreeIds<R>> & HandleOf<Id> & AnchorsOf<TreeIds<R>>;
export function mindmap(root: TreeItem, opts: MindmapOpts = {}): TreeBand {
  if (opts.sides) for (const [id, side] of Object.entries(opts.sides)) if (side !== 'left' && side !== 'right') throw new Error(`mindmap(): sides.${id} must be 'left' or 'right' (got ${String(side)})`);
  const band = tree(root, {...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)});
  Object.assign(band, {balanced: true, ...(opts.sides ? {sides: opts.sides} : {})});
  return band as never;
}

/**
 * A horizontal time axis with a deadline: the axis (`from` - `to`), today (`now`), the deadline and the span between them
 * ("あと 1 年 3 か月"), plus optional marks. Dates are 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'; `now` is always written out, never read from the clock.
 */
export function timeline<const Id extends string = never>(opts: TimelineOpts & {id?: Id}): TimelineBand & Declares<Id> & HandleOf<Id>;
export function timeline(opts: TimelineOpts): TimelineBand {
  const day = (v: unknown, what: string): number => timelineDay(v as string, what);
  const from = day(opts?.from, 'from'), to = day(opts?.to, 'to');
  if (!(from < to)) throw new Error(`timeline(): from (${opts.from}) must be before to (${opts.to})`);
  for (const [k, v] of [['now', opts.now], ['deadline', opts.deadline]] as const) {
    if (!v || typeof v !== 'object') throw new Error(`timeline(): ${k} is required (${k === 'now' ? "{at: '2026-10'}" : "{at: '2027-03', label: 'サポート終了'}"})`);
    const t = day(v.at, `${k}.at`);
    if (t < from || t > to) throw new Error(`timeline(): ${k}.at (${v.at}) is outside the axis (${opts.from} - ${opts.to})`);
  }
  if (opts.deadline.line !== undefined && opts.deadline.line !== 'full') throw new Error(`timeline(): deadline.line must be 'full' (got ${String(opts.deadline.line)})`);
  if (opts.span !== undefined && opts.span !== 'bar' && opts.span !== 'fill') throw new Error(`timeline(): span must be 'bar' or 'fill' (got ${String(opts.span)})`);
  if (opts.now.label !== undefined && (typeof opts.now.label !== 'string' || !opts.now.label.trim())) throw new Error('timeline(): now.label must not be empty (leave it out for "現在")');
  if (typeof opts.deadline.label !== 'string' || !opts.deadline.label.trim()) throw new Error('timeline(): deadline.label is required');
  for (const [i, m] of (opts.marks ?? []).entries()) {
    const t = day(m.at, `marks[${i}].at`);
    if (t < from || t > to) throw new Error(`timeline(): marks[${i}].at (${m.at}) is outside the axis (${opts.from} - ${opts.to})`);
    if (typeof m.label !== 'string' || !m.label.trim()) throw new Error(`timeline(): marks[${i}].label is required`);
    if (m.tone !== undefined && !['accent', 'danger', 'muted'].includes(m.tone)) throw new Error(`timeline(): marks[${i}].tone must be accent, danger or muted (got ${m.tone})`);
  }
  if (opts.remaining !== undefined && opts.remaining !== false && (typeof opts.remaining !== 'string' || !opts.remaining.trim())) throw new Error('timeline(): remaining must be a string or false');
  return withHandle({type: 'timeline', from: opts.from, to: opts.to, now: opts.now, deadline: opts.deadline, ...(opts.span === undefined ? {} : {span: opts.span}), ...(opts.marks ? {marks: opts.marks} : {}), ...(opts.remaining === undefined ? {} : {remaining: opts.remaining}), ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts)}, opts.id);
}

// Escape hatch. `draw(ctx)` must return a raw SVG fragment string; it
// receives its allocated origin/size and a couple of tone-aware helpers, but
// nothing stops it from emitting arbitrary markup — the fragment is passed
// through emit.ts unmodified. build() runs `lint-svg.ts --strict` on the
// finished file regardless, so an off-token color or sub-14px size written
// here still gets caught before the file is trusted — raw() only escapes
// layout, never the constraint system's verification step.
export function raw(opts: RawOpts): RawBand {
  assertNoReveal(opts, 'raw()');
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
// opts.name: the SVG's published name when outPath is a scratch file (it keys the slide-budget cache). opts.lint: false skips the per-file lint-svg.ts run (it starts its own Chromium), for callers that lint many
// files in one go afterwards (build-diagram.ts). Default true.
export async function build(d: Diagram, outPath: string, opts: {lint?: boolean; name?: string; html?: boolean} = {}): Promise<BuildResult> {
  const r = await renderDiagram(d, {name: opts.name ?? path.basename(outPath), budget: 'measure', html: opts.html});
  return finishBuild(r, outPath, opts.lint ?? true);
}

// Everything build() does short of the disk: layout (with the slide budget and the fill / font scale search), verification,
// the SVG, its XML well-formedness. It does not throw for a failed verification or a malformed SVG — it reports them in
// `verdict` and `xml`, so build() can refuse to write while `svg-diagram show` can still draw the picture and say what is wrong.
// (A define()/constructor/layout error still throws.) budget: 'measure' measures a slide that has no cached budget (starts the
// dev server, writes the cache); 'cacheOnly' reads the cache and falls back to the default sizes with a note.
export async function renderDiagram(input: Diagram, opts: {name: string; budget: 'measure' | 'cacheOnly'; html?: boolean}): Promise<RenderResult> {
  const d = detach(input); // the passes below write into bands (reveal, legend items) and into d (width, ...): never into the caller's
  const maxReveal = prepareReveal(d);
  applyAutoLegend(d);
  const notes: string[] = [];
  // A diagram that names its slide gets a measured height budget and width
  // (cached) instead of fit.ts's defaults.
  let budget: SlideBudget | null = null;
  let budgetSource: RenderResult['budgetSource'] = null;
  if (d.slide) {
    const key = {...d.slide, svg: opts.name};
    if (opts.budget === 'measure') {
      budget = await getSlideBudget(key);
      budgetSource = budget.cached ? 'cache' : 'measured';
    } else {
      budget = readSlideBudgetCache(key);
      budgetSource = budget ? 'cache' : 'default';
      if (!budget) notes.push(`スライドの空き寸法が未計測(キャッシュなし)なので既定の寸法で描いた。\`svg-diagram build\` で一度実測すると正確になる`);
    }
    if (budget) {
      d.maxDisplayHeight = budget.maxHeight;
      d.usableWidth = budget.contentWidth;
    }
  }
  // fill: true (fit-figure slides) — the <img> is stretched to the slide's free
  // area, so draw for that area: canvas as wide as the slot, and the largest
  // font/pad/gap scale (>= 1) whose laid-out height still fits the slot's
  // height. Without this a short diagram leaves the slot half empty and its
  // 14px text is as small as it was at 940px wide.
  let fontScale = 1;
  let laidOut: LaidOutDiagram;
  let verdict: Verdict, svg: string, html: string | undefined;
  // Every scale is its own value (scaleRoles): measured with, laid out with and drawn with the same roles, which travel in the result.
  const layoutAt = async (s: number): Promise<LaidOutDiagram> => {
    const roles = d.canvas ? canvasRoles(s) : scaleRoles(ROLES, s);
    return layoutDiagram({...d, pad: Math.round(d.pad * s), gap: Math.round(d.gap * s)}, {roles});
  };
  if (d.fill && budget) {
    d.width = budget.contentWidth;
    let lo = 1, hi = fillScaleLimit(d.bands);
    if ((await layoutAt(1)).canvasHeight > budget.maxHeight) hi = 1; // doesn't even fit at 1x: report via fit warnings
    for (let i = 0; i < 7 && hi - lo > 0.01; i++) {
      const mid = (lo + hi) / 2;
      if ((await layoutAt(mid)).canvasHeight <= budget.maxHeight) lo = mid; else hi = mid;
    }
    fontScale = Math.floor(lo * 100) / 100;
  } else if (d.canvas) {
    // a whole-slide canvas is drawn 1:1, so everything is scaled until the smallest text is the canvas's minimum
    fontScale = canvasFontScale(d.canvas.minText);
  } else if (d.fill) {
    if (opts.budget === 'measure' || !d.slide) throw new Error('diagram({fill: true}) needs diagram({slide: {page, heading}}) to know the slot size');
    notes.push('fill: true の図はスライドの空き寸法が要るため、既定の幅・倍率で描いた');
  }
  laidOut = await layoutAt(fontScale);
  laidOut.fontScale = fontScale;
  applySpotlight(laidOut);
  verdict = verifyDiagram(laidOut);
  svg = emitSvg(laidOut, maxReveal ? {reveal: maxReveal} : {});
  if (opts.html) html = emitHtml(laidOut, maxReveal ? {reveal: maxReveal} : {});
  return {svg, ...(html !== undefined ? {html} : {}), laidOut, verdict, xml: xmlProblems(svg), notes, width: laidOut.width, height: laidOut.canvasHeight, fit: analyzeFit(laidOut), budget, budgetSource, fontScale: laidOut.fontScale};
}

/** What the passes may write into: the bands are copied, so a band shared by two diagrams (or drawn twice) is never changed by a render. */
function detach<D extends DiagramData>(d: D): D {
  return {...d, bands: cloneData(d.bands)};
}
/**
 * A deep copy of plain data: arrays and plain objects (Object.prototype or null prototype) are copied; everything else is
 * shared — a function (a raw() band's draw), a string, a Map / Set / Date / RegExp, a class instance. (structuredClone throws
 * on raw()'s function; copying a class instance by hand breaks private fields and internal slots.) The same object met twice
 * is copied once, so a band placed in two spots stays one band in the copy, and a cycle ends.
 * Known gap: a class instance handed in as plan data (a point of plane({points})) is shared, so a reveal written into it by
 * prepareReveal can still show in another figure. Not copied: non-enumerable properties (the .left / .right / .at handles,
 * withAnchors' anchors) and symbol keys (NUMBERING, GIVEN, RICH) — add() has used them up and nothing downstream reads them.
 */
function cloneData<T>(v: T, seen = new WeakMap<object, unknown>()): T {
  if (!v || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v) as T;
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    seen.set(v, out);
    for (const x of v) out.push(cloneData(x, seen));
    return out as T;
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return v;
  const out = Object.create(proto);
  seen.set(v, out);
  for (const [k, x] of Object.entries(v)) out[k] = cloneData(x, seen);
  return out;
}

// Layout + verification + rules, without writing any file: the engine behind `svg-diagram check`.
export async function checkDiagram(input: DiagramData): Promise<CheckResult> {
  const d = detach(input);
  prepareReveal(d);
  applyAutoLegend(d);
  // a canvas diagram is drawn at its font scale, so it is checked at that scale too
  const s = d.canvas ? canvasFontScale(d.canvas.minText) : 1;
  const laidOut = await layoutDiagram(d.canvas ? {...d, pad: Math.round(d.pad * s), gap: Math.round(d.gap * s)} : d, d.canvas ? {roles: canvasRoles(s)} : {});
  applySpotlight(laidOut);
  return {laidOut, verdict: verifyDiagram(laidOut)};
}

async function finishBuild(r: RenderResult, outPath: string, lint: boolean): Promise<BuildResult> {
  const {verdict} = r;
  if (!verdict.ok) {
    throw new Error(`build(${outPath}): layout verification failed before any SVG was written:\n  ${verdict.problems.join('\n  ')}`);
  }
  if (r.xml.length) throw new Error(`build(${outPath}): the emitted SVG is not well-formed XML (an <img> would fail to load it):\n  ${r.xml.join('\n  ')}`);
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, r.svg);
  let htmlPath: string | undefined;
  if (r.html !== undefined) {
    htmlPath = outPath.replace(/\.svg$/, '') + '.html';
    fs.writeFileSync(htmlPath, r.html);
  }
  const revealPaths: string[] = [];
  if (r.laidOut.maxReveal) {
    const ext = path.extname(outPath), stem = outPath.slice(0, -ext.length);
    for (let stage = 0; stage <= r.laidOut.maxReveal; stage++) {
      const revealPath = `${stem}.reveal${stage}${ext}`;
      fs.writeFileSync(revealPath, emitSvg(r.laidOut, {reveal: stage}));
      revealPaths.push(revealPath);
    }
  }
  const ext = path.extname(outPath), stem = outPath.slice(0, -ext.length);
  for (const name of fs.readdirSync(path.dirname(outPath))) {
    const m = new RegExp(`^${path.basename(stem).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.reveal(\\d+)${ext.replace('.', '\\.')}$$`).exec(name);
    if (m && (!r.laidOut.maxReveal || Number(m[1]) > r.laidOut.maxReveal)) fs.rmSync(path.join(path.dirname(outPath), name));
  }

  const lintScript = path.resolve(import.meta.dirname, '..', import.meta.url.endsWith('.ts') ? 'lint-svg.ts' : 'lint-svg.js');
  if (lint) try {
    execFileSync('node', [lintScript, outPath, '--strict'], {encoding: 'utf8'});
  } catch (err) {
    const e = err as {stdout?: string; stderr?: string};
    const out = (e.stdout || '') + (e.stderr || '');
    throw new Error(`build(${outPath}) produced an SVG that fails lint-svg.ts --strict:\n${out}`);
  }
  return {outPath, ...(htmlPath ? {htmlPath} : {}), revealPaths, width: r.width, height: r.height, fit: r.fit, budget: r.budget, fontScale: r.fontScale, warnings: verdict.warnings, findings: verdict.findings};
}

export {closeMeasurer};
