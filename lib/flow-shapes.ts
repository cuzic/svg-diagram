// flowShapes: the stock business figures drawn as one band each — chevron (process arrows), funnel (narrowing stages), cycle
// (a closed loop of nodes; with `links`, items on a regular polygon joined pair by pair: ADR 0065), venn (2 or 3 sets), concentric (nested
// rings; with `sectors`, cut into sectors and carrying marks: ADR 0065) and emblem (a word or two inside a circle / triangle / ...). Everything is placed by this file:
//   * every text is wrapped to the room its shape gives it, and flowShapeTexts() registers exactly the texts / sizes / weights
//     the layout draws (an unregistered atom would measure 0 wide),
//   * cycle arrows run along the ring between the nodes (they never cross a node or its label),
//   * venn labels sit in their own region (a pair's label in the part only that pair shares, not in the middle),
//   * a side key of concentric() is tied to its ring by a leader line, so the key does not depend on colour.
// verify.ts checks that every label stays inside the figure and that no two labels overlap.
import {partStep} from './parts.ts';
import {resolveLoopBacks} from './loop-back.ts';
import type {LoopBack} from './types/containers.ts';
import {assertScope} from './scope-name.ts';
import {textWidth} from './atoms.ts';
import {TONES, isSolidTone} from './tokens.ts';
import {resolveFocus, sequenceTones} from './focus.ts';
import {EMBLEM_FLEX, EMBLEM_SHAPES, EMBLEM_TEXT, emblemHeight, emblemMaxHeight, emblemOutline} from './emblem-shapes.ts';
import type {EmblemShape} from './emblem-shapes.ts';
import {wrapText} from './wrap.ts';
import {katakanaWidth} from './tree.ts';
import type {Anchor, Dimmed, EmphasisTone, Focus, FocusOpts, FontFamily, Rect, RevealOpts, ScopeOpts, Roles, TextTone, WidthOf, WrapMode} from './types/core.ts';

import {must} from './must.ts';
/** `tone` 'solid' / 'solid-danger' fill the step (white text). */
export interface FlowStep {label: string; sub?: string; id?: string; tone?: EmphasisTone}
export interface ChevronOpts extends RevealOpts, ScopeOpts, FocusOpts {/** The arrows back to earlier steps, drawn under a horizontal chevron: `{from: 4, to: 2, label}` (1-based numbers or item ids). Several loops must nest. */ loopBack?: LoopBack | readonly LoopBack[]; id?: string; direction?: 'horizontal' | 'vertical'; first?: 'pentagon' | 'chevron'; gap?: number; current?: number; highlight?: number; width?: number}
export interface FunnelStage {label: string; value?: number; id?: string; tone?: EmphasisTone}
export interface FunnelOpts extends RevealOpts, ScopeOpts, FocusOpts {id?: string; scale?: 'value' | 'even'; showRate?: boolean; width?: number}
/** A link of a cycle with `links` (ADR 0065): two steps (1-based number, id or label), two-way unless `direction: 'forward'`. */
export interface CycleLink {from: number | string; to: number | string; label?: string; direction?: 'both' | 'forward'}
export interface CycleOpts extends RevealOpts, ScopeOpts, FocusOpts {
  id?: string; centre?: string; direction?: 'cw' | 'ccw'; width?: number;
  /** ADR 0065: instead of the arrows round the ring, the steps on a regular polygon joined pair by pair — 'all' (every pair, two-way; up to 6 steps) or the links to draw. The CBT five-part model. */
  links?: 'all' | readonly CycleLink[];
  /** ADR 0065: a frame round the figure, and its name (the five-part model's 「状況・環境」). */
  frame?: string;
}
export interface VennSet {name: string; label?: string; id?: string; tone?: TextTone}
export interface VennOverlap {sets: readonly string[]; label: string}
export interface VennOpts extends RevealOpts, ScopeOpts {id?: string; overlaps?: readonly VennOverlap[]; centre?: string; universe?: string | boolean; width?: number}
export interface ConcentricRing {label: string; description?: string; id?: string; tone?: TextTone}
export type {EmblemShape} from './emblem-shapes.ts';
export interface EmblemItem {label: string; sub?: string; shape?: EmblemShape; id?: string; tone?: EmphasisTone}
export interface EmblemOpts extends RevealOpts, ScopeOpts, FocusOpts {id?: string; /** The shape of every item that does not name its own. */ shape?: EmblemShape; gap?: number; /** The least width of a shape (the shapes grow to hold their text, all to the same size). */ minSize?: number; width?: number}
export interface ValueChainOpts extends RevealOpts, ScopeOpts, FocusOpts {id?: string; /** The label of the margin arrow at the right end; `false` leaves the arrow out. Default 'マージン'. */ margin?: string | false; /** The captions over the support bars and the primary chevrons; `false` leaves them out. Default ['支援活動', '主活動']. */ titles?: readonly [support: string, primary: string] | false; width?: number}
export interface ConcentricOpts extends RevealOpts, ScopeOpts {
  id?: string; order?: 'outer-first' | 'inner-first'; labels?: 'inside' | 'side'; centre?: string; width?: number;
  /** ADR 0065: the rings cut into sectors, from 12 o'clock clockwise (1-8): the Values Bullseye's life domains, a technology radar's quadrants. */
  sectors?: readonly ConcentricSector[];
  /** ADR 0065: marks in the sectors (needs `sectors`). */
  marks?: readonly ConcentricMark[];
  /** The two words of the key under the figure when a mark has `from` — where it was, where it is (default ['前回', '今回']); false leaves the key out. */
  fromLegend?: readonly [was: string, now: string] | false;
}
/** A sector of a concentric (ADR 0065). */
export interface ConcentricSector {label: string; id?: string}
/** A ring or a sector by its 1-based number (as `rings` / `sectors` are written) or its label (or id). */
export type ConcentricRef = number | string;
/** Where a mark was last time: its ring (or r), and its sector when that changed. */
export interface ConcentricPlace {ring?: ConcentricRef; r?: number; sector?: ConcentricRef}
/** A mark in a sector, at a ring (its middle) or at r (0 = the centre, 1 = the outer edge); `from` draws the move since last time. */
export interface ConcentricMark {label: string; sector: ConcentricRef; ring?: ConcentricRef; r?: number; id?: string; tone?: TextTone; from?: ConcentricPlace}
export interface ChevronBand extends Omit<ChevronOpts, 'focus'> {type: 'chevron'; steps: FlowStep[]; direction: 'horizontal' | 'vertical'; first: 'pentagon' | 'chevron'; gap: number}
export interface FunnelBand extends Omit<FunnelOpts, 'focus'> {type: 'funnel'; stages: FunnelStage[]; scale: 'value' | 'even'; showRate: boolean}
export interface CycleBand extends Omit<CycleOpts, 'focus' | 'links'> {type: 'cycle'; steps: FlowStep[]; direction: 'cw' | 'ccw'; /** resolved: 0-based steps */ links?: {from: number; to: number; label?: string; both: boolean}[]}
export interface VennBand extends VennOpts {type: 'venn'; sets: VennSet[]; overlaps: VennOverlap[]}
/** Where a mark is: a ring (0-based from the centre; drawn at its middle) or r (0..1 of the radius). */
export type MarkAt = {ring: number} | {r: number};
/** A mark with its sector (0-based) and place resolved; `from` likewise. */
export interface ConcentricPlaced {label: string; id?: string; tone: TextTone; sector: number; at: MarkAt; from?: {sector: number; at: MarkAt}}
export interface ConcentricBand extends Omit<ConcentricOpts, 'sectors' | 'marks'> {type: 'concentric'; rings: ConcentricRing[]; order: 'outer-first' | 'inner-first'; labels: 'inside' | 'side'; sectors?: ConcentricSector[]; marks?: ConcentricPlaced[]}
export interface EmblemBand extends Omit<EmblemOpts, 'focus'> {type: 'emblem'; items: EmblemItem[]; shape: EmblemShape; gap: number}
export interface ValueChainBand extends Omit<ValueChainOpts, 'focus'> {type: 'valueChain'; support: FlowStep[]; primary: FlowStep[]; margin: string | false; titles: readonly [string, string] | false}
export type FlowShapeBand = ChevronBand | FunnelBand | CycleBand | VennBand | ConcentricBand | EmblemBand | ValueChainBand;

/** A flow-shape text's colour: a text tone, or 'bg' (white) on a filled (solid) item. */
export type FlowTextTone = TextTone | 'bg';
export interface FlowText extends Rect {text: string; tx: number; ty: number; size: number; weight: 400 | 700; anchor: 'start' | 'middle' | 'end'; tone: FlowTextTone; /** ADR 0054: the part it is grouped in (a concentric ring's key). */ part?: string}
export type FlowPrimitive =
  | ({k: 'polygon'; points: [number, number][]; tone: EmphasisTone; strong?: boolean; /** the id of the item this is the frame of (ADR 0034: withNodeIds turns it into `dataNode`) */ node?: string; dataNode?: string; /** ADR 0054 */ part?: string} & Dimmed)
  | ({k: 'circle'; cx: number; cy: number; r: number; tone: TextTone; opacity?: number; dash?: string; /** Drawn as a box of this tone (filled, outlined) instead of a tinted ring. */ fill?: EmphasisTone; node?: string; dataNode?: string; /** ADR 0054 */ part?: string} & Dimmed)
  | ({k: 'rect'; x: number; y: number; w: number; h: number; tone: TextTone} & Dimmed)
  | ({k: 'path'; d: string; tone: TextTone; arrow?: boolean; thin?: boolean; /** Drawn as a box of this tone (filled, outlined) instead of a line; `box` is the extent of what is drawn. */ fill?: EmphasisTone; box?: Rect; node?: string; dataNode?: string; /** ADR 0054 */ part?: string} & Dimmed);
export interface LaidOutFlowShape extends Rect, Dimmed {type: FlowShapeBand['type']; id?: string; reveal?: number; until?: number; primitives: FlowPrimitive[]; texts: FlowText[]; anchors: Anchor[]; labelBoxes: (Rect & {label: string})[]; /** emblem: the bounding box of each shape that has an id (the checks' obstacle, which may be larger than its anchor). */ bounds?: Anchor[]; /** concentric with sectors (ADR 0065): the marks whose label could only be placed across a line */ crossings?: string[]}

// ---------------------------------------------------------------------------------------------------------------------------
// constructors (validation)
// ---------------------------------------------------------------------------------------------------------------------------

const BOX_TONES: ReadonlySet<string> = new Set<string>(['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger']);
const TEXT_TONES: ReadonlySet<string> = new Set<string>(['text', 'accent', 'muted', 'danger']);

function common(name: string, xs: readonly {label?: string; id?: string}[], id?: string): void {
  if (!xs.length) throw new Error(`${name}(): at least one item is required`);
  const ids = new Set<string>();
  for (const [i, x] of xs.entries()) {
    if (!x.label?.trim()) throw new Error(`${name}(): item ${i + 1} needs a non-empty label`);
    if (x.id && (x.id === id || ids.has(x.id))) throw new Error(`${name}(): duplicate id "${x.id}"`);
    if (x.id) ids.add(x.id);
  }
}
/** focus on a sequence (ADR 0051): a copy of the items, the focused ones 'solid' and the rest 'muted' (by id or 1-based number). */
function focusItems<T extends {id?: string; tone?: string}>(name: string, items: readonly T[], focus: Focus | undefined): T[] {
  if (focus === undefined) return [...items];
  const tones = sequenceTones(items.length, resolveFocus(focus, items.map(x => x.id), `${name}()`, true));
  return items.map((x, i) => ({...x, tone: must(tones[i])}));
}
/** The text tone on a filled (solid) item: white; otherwise the tone given. */
const onItem = (tone: string | undefined, base: FlowTextTone): FlowTextTone => isSolidTone(tone) ? 'bg' : base;
function checkTones(name: string, xs: readonly {tone?: string}[], allowed: ReadonlySet<string>): void {
  xs.forEach((x, i) => { if (x.tone && !allowed.has(x.tone)) throw new Error(`${name}(): item ${i + 1} has unknown tone "${x.tone}" (${[...allowed].join(' | ')})`); });
}

export function chevronBand(steps: readonly FlowStep[], opts: ChevronOpts = {}): ChevronBand {
  common('chevron', steps, opts.id);
  assertScope(opts.scope, 'chevron()');
  checkTones('chevron', steps, BOX_TONES);
  const current = opts.current ?? opts.highlight;
  if (current !== undefined && opts.focus !== undefined) throw new Error('chevron(): current / highlight and focus both mark a step: keep focus (the step filled, the others muted) or current (the step in the accent colour)');
  if (current !== undefined && (!Number.isInteger(current) || current < 0 || current >= steps.length)) throw new Error(`chevron(): current/highlight must be a zero-based step index (0..${steps.length - 1})`);
  if (opts.gap !== undefined && !(opts.gap >= 0)) throw new Error('chevron(): gap must be >= 0');
  if (opts.loopBack !== undefined && (opts.direction ?? 'horizontal') !== 'horizontal') throw new Error("chevron({direction: 'vertical'}): loopBack is for horizontal flows (a vertical chevron has no room under it)");
  const loopBack = opts.loopBack === undefined ? undefined : resolveLoopBacks('chevron()', opts.loopBack, steps.length, steps.map(s => s.id));
  const {focus, ...rest} = opts;
  return {...rest, ...(loopBack ? {loopBack} : {}), type: 'chevron', steps: focusItems('chevron', steps, focus), direction: opts.direction ?? 'horizontal', first: opts.first ?? 'pentagon', gap: opts.gap ?? 4};
}
export function funnelBand(stages: readonly FunnelStage[], opts: FunnelOpts = {}): FunnelBand {
  common('funnel', stages, opts.id);
  assertScope(opts.scope, 'funnel()');
  checkTones('funnel', stages, BOX_TONES);
  stages.forEach((s, i) => { if (s.value !== undefined && (!Number.isFinite(s.value) || s.value < 0)) throw new Error(`funnel(): stage ${i + 1} value must be a finite number >= 0`); });
  const scale = opts.scale ?? 'even';
  if (scale === 'value' && stages.some(s => s.value === undefined)) throw new Error('funnel(): scale "value" requires a value on every stage');
  const {focus, ...rest} = opts;
  return {...rest, type: 'funnel', stages: focusItems('funnel', stages, focus), scale, showRate: opts.showRate ?? false};
}
export function cycleBand(steps: readonly FlowStep[], opts: CycleOpts = {}): CycleBand {
  if (steps.length < 3 || steps.length > 8) throw new Error(`cycle(): needs 3..8 steps (got ${steps.length})`);
  common('cycle', steps, opts.id);
  assertScope(opts.scope, 'cycle()');
  checkTones('cycle', steps, BOX_TONES);
  if (opts.frame !== undefined && !opts.frame.trim()) throw new Error('cycle(): frame must be a non-empty name (leave it out for no frame)');
  const {focus, links: given, ...rest} = opts;
  return {...rest, type: 'cycle', steps: focusItems('cycle', steps, focus), direction: opts.direction ?? 'cw', ...(given === undefined ? {} : {links: cycleLinks(steps, given, opts.direction)})};
}
/** ADR 0065: the links of a cycle drawn as a polygon, as 0-based steps. */
function cycleLinks(steps: readonly FlowStep[], given: 'all' | readonly CycleLink[], direction: CycleOpts['direction']): NonNullable<CycleBand['links']> {
  if (direction !== undefined) throw new Error("cycle(): direction turns the arrows round the ring; with links each link says its own (direction: 'forward' on the link)");
  if (given !== 'all' && !Array.isArray(given)) throw new Error(`cycle(): links must be 'all' or a list of {from, to} (got ${JSON.stringify(given)})`);
  if (given === 'all' && steps.length > 6) throw new Error(`cycle(): links: 'all' joins every pair of up to 6 steps (got ${steps.length}: ${steps.length * (steps.length - 1) / 2} links) — list the links instead`);
  const links = given === 'all'
    ? steps.flatMap((_a, i) => steps.slice(i + 1).map((_b, k) => ({from: i, to: i + 1 + k, both: true})))
    : given.map((l, i) => {
      const from = refIndex('cycle', `link ${i + 1} from`, l.from, steps), to = refIndex('cycle', `link ${i + 1} to`, l.to, steps);
      if (from === to) throw new Error(`cycle(): link ${i + 1} joins "${must(steps[from]).label}" to itself`);
      if (l.direction !== undefined && l.direction !== 'both' && l.direction !== 'forward') throw new Error(`cycle(): link ${i + 1} direction must be 'both' or 'forward' (got ${JSON.stringify(l.direction)})`);
      return {from, to, ...(l.label ? {label: l.label} : {}), both: l.direction !== 'forward'};
    });
  if (!links.length) throw new Error("cycle(): links is empty — leave it out for the arrows round the ring, or write 'all'");
  const pairs = new Set<string>();
  for (const l of links) { const k = `${Math.min(l.from, l.to)},${Math.max(l.from, l.to)}`; if (pairs.has(k)) throw new Error(`cycle(): two links join "${must(steps[l.from]).label}" and "${must(steps[l.to]).label}" — keep one (it is two-way unless direction: 'forward')`); pairs.add(k); }
  return links;
}
export function vennBand(sets: readonly VennSet[], opts: VennOpts = {}): VennBand {
  if (sets.length < 2 || sets.length > 3) throw new Error(`venn(): needs 2 or 3 sets (got ${sets.length})`);
  common('venn', sets.map(s => ({label: s.name, id: s.id})), opts.id);
  assertScope(opts.scope, 'venn()');
  checkTones('venn', sets, TEXT_TONES);
  const names = new Set(sets.map(s => s.name));
  if (names.size !== sets.length) throw new Error('venn(): set names must be unique');
  const seen = new Set<string>();
  for (const o of opts.overlaps ?? []) {
    const named = new Set(o.sets);
    if (named.size < 2 || named.size !== o.sets.length || o.sets.some(n => !names.has(n))) throw new Error(`venn(): overlap "${o.label}" must name 2 or more different sets of this venn`);
    const key = [...named].sort().join('\u0000');
    if (seen.has(key)) throw new Error(`venn(): two overlaps name the same sets (${o.sets.join(', ')})`);
    seen.add(key);
    if (!o.label?.trim()) throw new Error('venn(): an overlap needs a non-empty label');
    if (opts.centre && named.size === sets.length) throw new Error(`venn(): centre and overlap "${o.label}" both label the part every set shares; keep one`);
  }
  return {...opts, type: 'venn', sets: [...sets], overlaps: [...(opts.overlaps ?? [])]};
}
/** `rings` may be a count (1-6) of plain rings when the rings are cut into `sectors` (a bullseye whose rings have no names). */
export function concentricBand(rings: readonly ConcentricRing[] | number, opts: ConcentricOpts = {}): ConcentricBand {
  assertScope(opts.scope, 'concentric()');
  if (typeof rings === 'number') {
    if (!opts.sectors) throw new Error('concentric(): rings is a number only with sectors (plain rings cut into sectors); otherwise name each ring');
    if (!(Number.isInteger(rings) && rings >= 1 && rings <= 6)) throw new Error(`concentric(): rings must be 1..6 (got ${rings})`);
  } else {
    common('concentric', rings, opts.id);
    checkTones('concentric', rings, TEXT_TONES);
  }
  const list: ConcentricRing[] = typeof rings === 'number' ? Array.from({length: rings}, () => ({label: ''})) : [...rings];
  const order = opts.order ?? 'outer-first', labels = opts.labels ?? 'inside';
  const {sectors, marks, ...rest} = opts;
  if (marks !== undefined && !sectors) throw new Error('concentric(): marks sit in sectors — give sectors too');
  if (opts.fromLegend !== undefined && !sectors) throw new Error('concentric(): fromLegend is the key of the marks\' moves — give sectors and marks');
  if (!sectors) return {...rest, type: 'concentric', rings: list, order, labels};
  if (labels === 'side') throw new Error("concentric(): with sectors the ring names are written along the 12 o'clock cut — leave out labels: 'side'");
  if (list.some(r => r.description)) throw new Error("concentric(): a ring's description is written in the side key only (labels: 'side'), which sectors do not have");
  if (list.length > 6) throw new Error(`concentric(): with sectors, 1..6 rings (got ${list.length})`);
  return {...rest, type: 'concentric', rings: list, order, labels, ...concentricMarks(list, order, sectors, marks, opts)};
}
/** ADR 0065: the sectors and the marks of a concentric, the marks' rings counted from the centre. */
function concentricMarks(rings: readonly ConcentricRing[], order: 'outer-first' | 'inner-first', sectors: readonly ConcentricSector[], given: readonly ConcentricMark[] | undefined, opts: ConcentricOpts): {sectors: ConcentricSector[]; marks: ConcentricPlaced[]} {
  if (sectors.length < 1 || sectors.length > 8) throw new Error(`concentric(): needs 1..8 sectors (got ${sectors.length})`);
  common('concentric', sectors, opts.id);
  const n = rings.length, plain = rings.every(r => !r.label);
  // a ring or a sector is named by its label: two with one label could not be told apart (nor share an id)
  for (const [what, xs] of [['sector', sectors], ['ring', plain ? [] : rings]] as const) {
    const seen = new Set<string>();
    for (const x of xs) { if (seen.has(x.label)) throw new Error(`concentric(): two ${what}s are labelled "${x.label}" — a mark names its ${what} by label, so each needs its own`); seen.add(x.label); }
  }
  const ids = new Set<string>();
  for (const x of [...rings, ...sectors]) if (x.id) { if (ids.has(x.id)) throw new Error(`concentric(): duplicate id "${x.id}"`); ids.add(x.id); }
  // a ring as written (1 = the first of `rings`) -> its place from the centre (0 = the innermost)
  const fromCentre = (i: number) => order === 'outer-first' ? n - 1 - i : i;
  const at = (what: string, ring: ConcentricRef | undefined, r: number | undefined): MarkAt => {
    if (ring !== undefined && r !== undefined) throw new Error(`concentric(): ${what} gives both ring and r — keep one`);
    if (r !== undefined) { if (!(typeof r === 'number' && r >= 0 && r <= 1)) throw new Error(`concentric(): ${what} r must be from 0 (the centre) to 1 (the outer edge) (got ${r})`); return {r}; }
    if (ring === undefined) throw new Error(`concentric(): ${what} needs a ring (1..${n}, in the order rings are written${plain ? '' : ', or its name'}) or r (0..1)`);
    if (typeof ring === 'string' && plain) throw new Error(`concentric(): ${what} names the ring "${ring}", but the rings have no names — give its number (1..${n})`);
    return {ring: fromCentre(refIndex('concentric', `${what} ring`, ring, rings))};
  };
  const marks = (given ?? []).map((m, i): ConcentricPlaced => {
    const what = `mark ${i + 1}${m?.label ? ` "${m.label}"` : ''}`;
    if (!m || typeof m.label !== 'string' || !m.label.trim()) throw new Error(`concentric(): mark ${i + 1} needs a non-empty label`);
    if (m.tone !== undefined && !TEXT_TONES.has(m.tone)) throw new Error(`concentric(): ${what} has unknown tone "${m.tone}" (${[...TEXT_TONES].join(' | ')})`);
    if (m.id !== undefined) { if (ids.has(m.id) || m.id === opts.id) throw new Error(`concentric(): duplicate id "${m.id}"`); ids.add(m.id); }
    const sector = refIndex('concentric', `${what} sector`, m.sector, sectors);
    const from = m.from === undefined ? undefined : {sector: m.from.sector === undefined ? sector : refIndex('concentric', `${what} from.sector`, m.from.sector, sectors), at: at(`${what} from`, m.from.ring, m.from.r)};
    return {label: m.label, ...(m.id ? {id: m.id} : {}), tone: m.tone ?? 'accent', sector, at: at(what, m.ring, m.r), ...(from ? {from} : {})};
  });
  const fl = opts.fromLegend;
  if (fl !== undefined && fl !== false && !(Array.isArray(fl) && fl.length === 2 && fl.every(x => typeof x === 'string' && x.trim()))) throw new Error("concentric(): fromLegend must be two words, [where it was, where it is] (default ['前回', '今回']), or false to leave the key out");
  return {sectors: [...sectors], marks};
}
const EMBLEM_SHAPE_SET: ReadonlySet<string> = new Set<string>(EMBLEM_SHAPES);
export function emblemBand(items: readonly EmblemItem[], opts: EmblemOpts = {}): EmblemBand {
  common('emblem', items, opts.id);
  assertScope(opts.scope, 'emblem()');
  checkTones('emblem', items, BOX_TONES);
  // the names this took before they were renamed: say so rather than ignore them (an ignored `kind` would silently draw circles)
  for (const [x, what] of [[opts, 'option'], ...items.map((i, n) => [i, `item ${n + 1}`] as const)] as const) {
    if ('kind' in x) throw new Error(`emblem(): \`kind\` is now \`shape\` (${what})`);
    if ('size' in x) throw new Error(`emblem(): \`size\` is now \`minSize\` (${what})`);
  }
  for (const k of [opts.shape, ...items.map(i => i.shape)]) if (k !== undefined && !EMBLEM_SHAPE_SET.has(k)) throw new Error(`emblem(): unknown shape "${String(k)}" (${EMBLEM_SHAPES.join(' | ')})`);
  if (opts.gap !== undefined && !(opts.gap >= 0)) throw new Error('emblem(): gap must be >= 0');
  if (opts.minSize !== undefined && !(opts.minSize >= 64 && opts.minSize <= EMBLEM_MAX)) throw new Error(`emblem(): minSize must be 64..${EMBLEM_MAX}`);
  const {focus, ...rest} = opts;
  return {...rest, type: 'emblem', items: focusItems('emblem', items, focus), shape: opts.shape ?? 'circle', gap: opts.gap ?? 16};
}

/** Porter's value chain (価値連鎖): support activities as bars over the primary activities as chevrons, and the margin as an arrow at the right. */
export function valueChainBand(parts: {support?: readonly (string | FlowStep)[]; primary: readonly (string | FlowStep)[]}, opts: ValueChainOpts = {}): ValueChainBand {
  const step = (x: string | FlowStep): FlowStep => typeof x === 'string' ? {label: x} : x;
  const support = (parts.support ?? []).map(step), primary = parts.primary.map(step);
  common('valueChain', primary, opts.id);
  if (support.length) common('valueChain', support, opts.id);
  const ids = [...support, ...primary].flatMap(s => s.id ? [s.id] : []);
  if (new Set(ids).size !== ids.length) throw new Error(`valueChain(): duplicate id "${ids.find((x, i) => ids.indexOf(x) !== i)}"`);
  assertScope(opts.scope, 'valueChain()');
  checkTones('valueChain', [...support, ...primary], BOX_TONES);
  if (opts.margin === '') throw new Error('valueChain(): margin must be a non-empty label, or false to leave the arrow out');
  // focus counts the support activities first, then the primary ones (as they are written)
  const {focus, ...rest} = opts, all = focusItems('valueChain', [...support, ...primary], focus);
  return {...rest, type: 'valueChain', support: all.slice(0, support.length), primary: all.slice(support.length), margin: opts.margin ?? 'マージン', titles: opts.titles ?? ['支援活動', '主活動']};
}

/** A 1-based number, or a label / id, as a 0-based index of `xs`. */
function refIndex(name: string, what: string, ref: number | string, xs: readonly {label: string; id?: string}[]): number {
  const i = typeof ref === 'number' ? (Number.isInteger(ref) && ref >= 1 && ref <= xs.length ? ref - 1 : -1) : xs.findIndex(x => x.id === ref || x.label === ref);
  if (i < 0) throw new Error(`${name}(): ${what} ${JSON.stringify(ref)} is not one of them (1..${xs.length}, or ${xs.map(x => `"${x.id ?? x.label}"`).join(' / ')})`);
  return i;
}
/** The item an item's frame names (ADR 0034): the id, when it has one. */
const nodeOf = (item: {id?: string}): {node?: string} => item.id ? {node: item.id} : {};

export const flowShapeIds = (b: FlowShapeBand): string[] => (b.type === 'valueChain' ? [...b.support, ...b.primary] : b.type === 'funnel' ? b.stages : b.type === 'venn' ? b.sets : b.type === 'concentric' ? [...b.rings, ...b.sectors ?? [], ...b.marks ?? []] : b.type === 'emblem' ? b.items : b.steps).flatMap(x => x.id ? [x.id] : []);

// ---------------------------------------------------------------------------------------------------------------------------
// texts: what the layout draws, at the size and weight it draws them (registered for measuring before layout)
// ---------------------------------------------------------------------------------------------------------------------------

type TextSpec = [text: string, size: number, weight: 400 | 700];
const funnelLabel = (s: FunnelStage): string => s.value === undefined ? s.label : `${s.label}  ${s.value}`;
const funnelRate = (prev: number | undefined, v: number | undefined): string | undefined => prev && v !== undefined ? `${Math.round(v / prev * 100)}%` : undefined;
const marksLegend = (b: ConcentricBand): readonly [string, string] | undefined => b.fromLegend === false || !b.marks?.some(m => m.from) ? undefined : b.fromLegend ?? ['前回', '今回'];
const ringLabel = (r: ConcentricRing): string => r.description ? `${r.label} — ${r.description}` : r.label;

function textSpecs(b: FlowShapeBand, roles: Roles): TextSpec[] {
  const bold = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 700]] : [];
  const plain = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 400]] : [];
  switch (b.type) {
    case 'chevron': return b.steps.flatMap(s => [...bold(s.label), ...plain(s.sub)]);
    case 'cycle': return [...b.steps.flatMap(s => [...bold(s.label), ...plain(s.sub)]), ...(b.centre ? [[b.centre, roles.label, 700] as TextSpec] : []), ...(b.links ?? []).flatMap(l => plain(l.label)), ...bold(b.frame)];
    case 'funnel': return b.stages.flatMap((s, i) => [...bold(funnelLabel(s)), ...(b.showRate && i ? plain(funnelRate(must(b.stages[i - 1]).value, s.value)) : [])]);
    case 'venn': return [...b.sets.flatMap(s => bold(s.label ?? s.name)), ...b.overlaps.flatMap(o => bold(o.label)), ...bold(b.centre), ...plain(typeof b.universe === 'string' ? b.universe : undefined)];
    case 'concentric': return b.sectors
      ? [...b.sectors.flatMap(x => bold(x.label)), ...b.rings.flatMap(r => plain(r.label || undefined)), ...(b.marks ?? []).flatMap(m => plain(m.label)), ...bold(b.centre), ...(marksLegend(b) ?? []).flatMap(plain)]
      : [...b.rings.flatMap(r => bold(ringLabel(r))), ...bold(b.centre)];
    case 'emblem': return b.items.flatMap(i => [...bold(i.label), ...plain(i.sub)]);
    case 'valueChain': return [...b.support, ...b.primary].flatMap(s => [...bold(s.label), ...plain(s.sub)]).concat(bold(b.margin || undefined), b.titles ? bold(b.titles[0]) : [], b.titles ? bold(b.titles[1]) : []);
  }
}
export function flowShapeTexts(b: FlowShapeBand, roles: Roles): [string, number, number, FontFamily][] {
  return textSpecs(b, roles).map(([t, size, weight]) => [t, size, weight, 'sans']);
}

// ---------------------------------------------------------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------------------------------------------------------

type Pt = [number, number];
const LINE = 1.35; // line step, in font sizes
const g4 = (v: number): number => Math.round(v / 4) * 4; // circle centres and frames sit on the 4px grid (lint: coordinate-grid)

export function layoutFlowShape(b: FlowShapeBand, x: number, y: number, cw: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): LaidOutFlowShape {
  const w = Math.min(cw, b.width ?? cw), ox = x + (cw - w) / 2;
  const out: LaidOutFlowShape = {type: b.type, id: b.id, reveal: b.reveal, until: b.until, x: ox, y, w, h: 0, primitives: [], texts: [], anchors: [], labelBoxes: []};
  const t = new Texts(out, widthOf, roles, mode);
  const anchor = (id: string | undefined, r: Rect, part?: string) => { if (id) out.anchors.push({id, ...r, ...(part ? {part} : {})}); };
  switch (b.type) {
    case 'chevron': layoutChevron(b, out, t, anchor); break;
    case 'funnel': layoutFunnel(b, out, t, anchor, roles); break;
    case 'cycle': framed(b.frame, out, t, () => b.links ? layoutLinked(b, out, t, anchor, roles) : layoutCycle(b, out, t, anchor, roles)); break;
    case 'venn': layoutVenn(b, out, t, anchor); break;
    case 'concentric': if (b.sectors) layoutSectors(b, out, t, anchor); else layoutConcentric(b, out, t, anchor, roles); break;
    case 'emblem': layoutEmblem(b, out, t, anchor); break;
    case 'valueChain': layoutValueChain(b, out, t, anchor); break;
  }
  return out;
}
/** `part`: the part the anchor is grouped in (ADR 0054), so a connector glued to it follows the item's group. */
type AnchorFn = (id: string | undefined, r: Rect, part?: string) => void;

/** A wrapped text block: measure it first (lines, height), then place it. */
class Texts {
  private out: LaidOutFlowShape; readonly widthOf: WidthOf; private roles: Roles; private mode: WrapMode;
  constructor(out: LaidOutFlowShape, widthOf: WidthOf, roles: Roles, mode: WrapMode) { this.out = out; this.widthOf = widthOf; this.roles = roles; this.mode = mode; }
  wrap(text: string, maxW: number, weight: 400 | 700 = 700, size = this.roles.note): {text: string; lines: string[]; h: number; w: number; size: number; weight: 400 | 700} {
    const atomWidth = (a: string) => this.widthOf(a, size, weight, 'sans');
    const lines = wrapText(text, {maxWidth: Math.max(24, maxW), atomWidth, mode: this.mode});
    return {text, lines, h: lines.length * size * LINE, w: Math.max(...lines.map(l => textWidth(this.widthOf, l, size, weight))), size, weight};
  }
  width(text: string, weight: 400 | 700 = 700, size = this.roles.note): number { return textWidth(this.widthOf, text, size, weight); }
  /** The height of one line of note text. */
  lineH(): number { return this.roles.note * LINE; }
  /** Places a wrapped block with its top at `top`; `x` is its centre (middle), left edge (start) or right edge (end). */
  place(block: ReturnType<Texts['wrap']>, x: number, top: number, tone: FlowTextTone = 'text', anchor: FlowText['anchor'] = 'middle', part?: string): void {
    const {size, weight} = block;
    block.lines.forEach((line, i) => {
      const tw = textWidth(this.widthOf, line, size, weight), ty = top + i * size * LINE + size * ((LINE - 1.2) / 2 + 1); // the glyph box (1.2 sizes) centred in its line
      const left = anchor === 'middle' ? x - tw / 2 : anchor === 'start' ? x : x - tw;
      const box = {x: left, y: ty - size, w: tw, h: size * 1.2};
      this.out.texts.push({text: line, tx: x, ty, size, weight, anchor, tone, ...box, ...(part ? {part} : {})});
      this.out.labelBoxes.push({label: block.text, ...box});
    });
  }
}

function layoutChevron(b: ChevronBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void {
  const vertical = b.direction === 'vertical', n = b.steps.length, current = b.current ?? b.highlight;
  const cellW = vertical ? (b.width ? out.w : Math.min(360, out.w)) : (out.w - b.gap * (n - 1)) / n;
  // horizontal: the notch on the left and the point on the right each take `tip` of the width; vertical: the point takes the bottom
  const tip = vertical ? 16 : Math.min(22, cellW / 4), textW = vertical ? cellW - 24 : cellW - 2 * tip - 8;
  const blocks = b.steps.map(s => ({label: t.wrap(s.label, textW), sub: s.sub ? t.wrap(s.sub, textW, 400) : undefined}));
  const textH = (k: typeof blocks[number]) => k.label.h + (k.sub?.h ?? 0);
  const cellH = Math.max(60, Math.max(...blocks.map(textH)) + 20 + (vertical ? tip : 0));
  out.h = vertical ? n * cellH + (n - 1) * b.gap : cellH;
  b.steps.forEach((s, i) => {
    const xx = vertical ? out.x + (out.w - cellW) / 2 : out.x + i * (cellW + b.gap), yy = vertical ? out.y + i * (cellH + b.gap) : out.y;
    const notch: Pt[] = i || b.first === 'chevron' ? [[xx + tip, yy + cellH / 2]] : [];
    const points: Pt[] = vertical
      ? [[xx, yy], [xx + cellW, yy], [xx + cellW, yy + cellH - tip], [xx + cellW / 2, yy + cellH], [xx, yy + cellH - tip]]
      : [[xx, yy], [xx + cellW - tip, yy], [xx + cellW, yy + cellH / 2], [xx + cellW - tip, yy + cellH], [xx, yy + cellH], ...notch];
    out.primitives.push({k: 'polygon', points, tone: current === i ? 'accent' : s.tone ?? 'plain', ...(current === i ? {strong: true} : {}), ...nodeOf(s)});
    anchor(s.id, {x: xx, y: yy, w: cellW, h: cellH});
    const k = must(blocks[i]), top = yy + (cellH - (vertical ? tip : 0) - textH(k)) / 2;
    t.place(k.label, xx + cellW / 2, top, onItem(s.tone, 'text'));
    if (k.sub) t.place(k.sub, xx + cellW / 2, top + k.label.h, onItem(s.tone, 'muted'));
  });
}

function layoutValueChain(b: ValueChainBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void {
  const gap = 4, tipM = 20;
  const marginW = b.margin ? Math.min(140, Math.max(76, t.width(b.margin) + tipM + 16)) : 0;
  const mainW = out.w - (b.margin ? marginW + 8 : 0);
  let y = out.y;
  const title = (text: string | undefined, part?: string) => {
    if (!text) return;
    const k = t.wrap(text, mainW);
    t.place(k, out.x, y, 'muted', 'start', part);
    y += k.h + 6;
  };
  const top = y;
  // ADR 0054 D9.2: the support activities, the primary activities and the margin are parts
  const titles = b.titles || undefined, support = partStep('support', 0, titles?.[0] ?? ''), primary = partStep('primary', 0, titles?.[1] ?? ''), margin = partStep('margin', 0, b.margin || '');
  // support activities: one bar each, full width
  if (b.support.length) {
    title(b.titles ? b.titles[0] : undefined, support);
    for (const s of b.support) {
      const label = t.wrap(s.label, mainW - 24), sub = s.sub ? t.wrap(s.sub, mainW - 24, 400) : undefined;
      const h = Math.max(36, label.h + (sub?.h ?? 0) + 16), textTop = y + (h - label.h - (sub?.h ?? 0)) / 2;
      out.primitives.push({k: 'polygon', points: [[out.x, y], [out.x + mainW, y], [out.x + mainW, y + h], [out.x, y + h]], tone: s.tone ?? 'muted', ...nodeOf(s), part: support});
      anchor(s.id, {x: out.x, y, w: mainW, h}, support);
      t.place(label, out.x + mainW / 2, textTop, onItem(s.tone, 'text'), 'middle', support);
      if (sub) t.place(sub, out.x + mainW / 2, textTop + label.h, onItem(s.tone, 'muted'), 'middle', support);
      y += h + gap;
    }
    y += 8 - gap;
  }
  // primary activities: chevrons, the first one a pentagon
  title(b.titles ? b.titles[1] : undefined, primary);
  const n = b.primary.length, cellW = (mainW - gap * (n - 1)) / n, tip = Math.min(18, cellW / 4), textW = cellW - 2 * tip - 4;
  const blocks = b.primary.map(s => ({label: t.wrap(s.label, textW), sub: s.sub ? t.wrap(s.sub, textW, 400) : undefined}));
  const textH = (k: typeof blocks[number]) => k.label.h + (k.sub?.h ?? 0);
  const cellH = Math.max(72, Math.max(...blocks.map(textH)) + 24);
  b.primary.forEach((s, i) => {
    const xx = out.x + i * (cellW + gap), yy = y;
    const notch: Pt[] = i ? [[xx + tip, yy + cellH / 2]] : [];
    out.primitives.push({k: 'polygon', points: [[xx, yy], [xx + cellW - tip, yy], [xx + cellW, yy + cellH / 2], [xx + cellW - tip, yy + cellH], [xx, yy + cellH], ...notch], tone: s.tone ?? 'plain', ...nodeOf(s), part: primary});
    anchor(s.id, {x: xx, y: yy, w: cellW, h: cellH}, primary);
    const k = must(blocks[i]), textTop = yy + (cellH - textH(k)) / 2;
    t.place(k.label, xx + cellW / 2, textTop, onItem(s.tone, 'text'), 'middle', primary);
    if (k.sub) t.place(k.sub, xx + cellW / 2, textTop + k.label.h, onItem(s.tone, 'muted'), 'middle', primary);
  });
  const bottom = y + cellH;
  // the margin: a tall arrow over the whole height, pointing right
  if (b.margin) {
    const mx = out.x + out.w - marginW, mid = (top + bottom) / 2;
    out.primitives.push({k: 'polygon', points: [[mx, top], [mx + marginW - tipM, top], [mx + marginW, mid], [mx + marginW - tipM, bottom], [mx, bottom]], tone: 'accent', strong: true, part: margin});
    const label = t.wrap(b.margin, marginW - tipM - 4);
    t.place(label, mx + (marginW - tipM) / 2, mid - label.h / 2, 'text', 'middle', margin);
  }
  out.h = bottom - out.y;
}

function layoutFunnel(b: FunnelBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn, roles: Roles): void {
  const n = b.stages.length, w = out.w, cx = out.x + w / 2, minW = Math.min(150, w * .3), max = Math.max(...b.stages.map(s => s.value ?? 0), 1);
  const frac = (i: number) => b.scale === 'value' ? (must(b.stages[i]).value ?? 0) / max : n === 1 ? 1 : 1 - i * .65 / (n - 1);
  const tops = b.stages.map((_, i) => Math.max(minW, w * frac(i)));
  const bottoms = tops.map((top, i) => i < n - 1 ? must(tops[i + 1]) : Math.max(minW * .8, top * .8)); // each stage ends where the next begins
  const lh = roles.note * LINE;
  const plans = b.stages.map((s, i) => {
    const text = funnelLabel(s), ti = must(tops[i]), bi = must(bottoms[i]), inner = Math.min(ti, bi) - 24, sideLeft = cx + Math.max(ti, bi) / 2 + 14, sideW = out.x + w - sideLeft;
    const beside = t.width(text) > inner && sideW >= 80; // too wide for the stage: to its right, when there is room
    const label = t.wrap(text, beside ? sideW : inner);
    const rateText = b.showRate && i ? funnelRate(must(b.stages[i - 1]).value, s.value) : undefined;
    const rate = rateText ? t.wrap(rateText, w, 400) : undefined;
    const rateLeft = rate !== undefined && cx - Math.max(ti, bi) / 2 - 14 - rate.w >= out.x; // else under the label
    return {label, beside, sideLeft, rate, rateLeft};
  });
  const rowH = Math.max(64, ...plans.map(p => p.label.h + (p.rate && !p.rateLeft ? p.rate.h : 0) + 20));
  out.h = n * rowH;
  b.stages.forEach((s, i) => {
    const yy = out.y + i * rowH, a = must(tops[i]), z = must(bottoms[i]), p = must(plans[i]);
    const part = partStep('stage', s.id ?? i, s.label); // ADR 0054: a stage, its label and the rate into it
    out.primitives.push({k: 'polygon', points: [[cx - a / 2, yy], [cx + a / 2, yy], [cx + z / 2, yy + rowH - 4], [cx - z / 2, yy + rowH - 4]], tone: s.tone ?? (i % 2 ? 'muted' : 'accent'), ...nodeOf(s), part});
    anchor(s.id, {x: cx - Math.max(a, z) / 2, y: yy, w: Math.max(a, z), h: rowH - 4}, part);
    const blockH = p.label.h + (p.rate && !p.rateLeft ? p.rate.h : 0), top = yy + (rowH - 4 - blockH) / 2;
    const lx = p.beside ? p.sideLeft : cx, la = p.beside ? 'start' : 'middle';
    t.place(p.label, lx, top, p.beside ? 'text' : onItem(s.tone, 'text'), la, part);
    if (p.rate) {
      if (p.rateLeft) t.place(p.rate, cx - Math.max(a, z) / 2 - 14, yy + (rowH - 4 - lh) / 2, 'muted', 'end', part);
      else t.place(p.rate, lx, top + p.label.h, p.beside ? 'muted' : onItem(s.tone, 'muted'), la, part);
    }
  });
}

function layoutCycle(b: CycleBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn, roles: Roles): void {
  const w = out.w, n = b.steps.length, h0 = Math.min(520, Math.max(300, w * .62));
  const sinN = Math.sin(Math.PI / n), ARROW_ROOM = 20; // the gap between adjacent circles is at least 2 * ARROW_ROOM, with room left for the arrow
  let R = Math.min(w, h0) * .34;
  let nr = Math.max(28, Math.min(54, R * .38, R * sinN - 14));
  // A katakana word wider than the label area (1.5 nr) would be cut mid-word: grow the circles for it, and the ring (and the height) with them,
  // as far as the width and a 760px height allow. Cycles whose words already fit are drawn exactly as before.
  const word = Math.max(0, ...b.steps.map(s => Math.max(katakanaWidth(s.label, t.widthOf, roles.note, 700), s.sub ? katakanaWidth(s.sub, t.widthOf, roles.note, 400) : 0)));
  if (word > nr * 1.5) {
    const want = Math.ceil(word / 1.5);
    const rMax = Math.min(w / 2 - 4 - want, (760 - 16) / 2 - want); // the ring plus a circle stays inside the width and the height cap
    const rNeed = Math.max(R, 2 * want, (want + ARROW_ROOM) / sinN);
    if (rMax > R) { R = Math.min(rNeed, rMax); nr = Math.max(nr, Math.min(want, R * .5, R * sinN - ARROW_ROOM)); }
  }
  const h = Math.max(h0, 2 * (R + nr) + 16);
  out.h = h;
  const cx = out.x + w / 2, cy = out.y + h / 2;
  const sign = b.direction === 'cw' ? 1 : -1, angle = (i: number) => -Math.PI / 2 + sign * 2 * Math.PI * i / n;
  const at = (a: number, r = R): Pt => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const skip = 2 * Math.asin(Math.min(1, (nr + 8) / (2 * R))); // the angle a node (plus a gap) covers on the ring
  const r1 = (v: number) => Math.round(v * 10) / 10;
  // ADR 0054: a step is its circle, its label and the arrow that leaves it
  const stepPart = (i: number): string => partStep('step', b.steps[i]?.id ?? i, b.steps[i]?.label ?? '');
  b.steps.forEach((_s, i) => {
    const [p, q] = [at(angle(i) + sign * skip), at(angle(i + 1) - sign * skip)];
    out.primitives.push({k: 'path', d: `M${r1(p[0])},${r1(p[1])} A${r1(R)},${r1(R)} 0 0 ${sign > 0 ? 1 : 0} ${r1(q[0])},${r1(q[1])}`, tone: 'text', arrow: true, part: stepPart(i)});
  });
  b.steps.forEach((s, i) => {
    const [ax, ay] = at(angle(i)), nx = g4(ax), ny = g4(ay);
    const tone: TextTone = s.tone === 'danger' || s.tone === 'removed' ? 'danger' : s.tone === 'muted' ? 'muted' : 'accent';
    // a solid step is a filled circle (white text); the others keep the tinted ring
    out.primitives.push({k: 'circle', cx: nx, cy: ny, r: nr, tone, ...(isSolidTone(s.tone) ? {fill: s.tone} : {}), ...nodeOf(s), part: stepPart(i)});
    anchor(s.id, {x: nx - nr, y: ny - nr, w: 2 * nr, h: 2 * nr}, stepPart(i));
    const label = t.wrap(s.label, nr * 1.5), sub = s.sub ? t.wrap(s.sub, nr * 1.5, 400) : undefined, top = ny - (label.h + (sub?.h ?? 0)) / 2;
    t.place(label, nx, top, onItem(s.tone, 'text'), 'middle', stepPart(i));
    if (sub) t.place(sub, nx, top + label.h, onItem(s.tone, 'muted'), 'middle', stepPart(i));
  });
  if (b.centre) { const c = t.wrap(b.centre, 1.5 * (R - nr), 700, roles.label); t.place(c, cx, cy - c.h / 2); }
}

function layoutVenn(b: VennBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void {
  const w = out.w, three = b.sets.length === 3, uni = !!b.universe;
  const r = three ? Math.min(w * .21, 170) : Math.min(w * .23, 190);
  const above = three ? 1.28 * r : r, below = three ? 1.52 * r : r; // how far the circles reach above / below the centre
  const padTop = uni ? 40 : 8, padBottom = uni ? 20 : 8;
  out.h = padTop + above + below + padBottom;
  const cx = out.x + w / 2, cy = out.y + padTop + above;
  const pos = (three ? [[cx - r * .55, cy - r * .28], [cx + r * .55, cy - r * .28], [cx, cy + r * .52]] : [[cx - r * .58, cy], [cx + r * .58, cy]]).map(p => p.map(g4) as Pt);
  const mid: Pt = [pos.reduce((a, p) => a + p[0], 0) / pos.length, pos.reduce((a, p) => a + p[1], 0) / pos.length];
  if (uni) {
    const fx = g4(out.x + 4), fy = g4(out.y + 4);
    out.primitives.push({k: 'rect', x: fx, y: fy, w: g4(out.x + w - 4) - fx, h: g4(out.y + out.h - 4) - fy, tone: 'muted'});
    if (typeof b.universe === 'string') t.place(t.wrap(b.universe, w - 32, 400), out.x + 16, out.y + 10, 'muted', 'start');
  }
  const DASH = ['', '7,5', '2,4'], TONES: TextTone[] = ['accent', 'danger', 'muted'];
  const centred = (text: string, [px, py]: Pt, maxW: number) => { const k = t.wrap(text, maxW); t.place(k, px, py - k.h / 2); };
  b.sets.forEach((s, i) => {
    const [px, py] = must(pos[i]), dx = px - mid[0], dy = py - mid[1], d = Math.hypot(dx, dy) || 1, k = three ? .5 : .42;
    out.primitives.push({k: 'circle', cx: px, cy: py, r, tone: s.tone ?? must(TONES[i]), opacity: .22, ...(DASH[i] ? {dash: DASH[i]} : {}), ...nodeOf(s)});
    anchor(s.id, {x: px - r, y: py - r, w: 2 * r, h: 2 * r});
    centred(s.label ?? s.name, [px + dx / d * k * r, py + dy / d * k * r], .8 * r); // in the part only this set covers
  });
  for (const o of b.overlaps) {
    const idx = o.sets.map(name => b.sets.findIndex(s => s.name === name));
    if (idx.length === b.sets.length) { centred(o.label, mid, (three ? .55 : .7) * r); continue; }
    // a pair of three: the middle of the part only these two share, on the side away from the third circle
    const [p, q] = [must(pos[must(idx[0])]), must(pos[must(idx[1])])], third = must(pos[must([0, 1, 2].find(j => !idx.includes(j)))]);
    const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], D = Math.hypot(m[0] - third[0], m[1] - third[1]);
    const half = Math.sqrt(r * r - (Math.hypot(p[0] - q[0], p[1] - q[1]) / 2) ** 2), reach = (r + D + half) / 2;
    centred(o.label, [third[0] + (m[0] - third[0]) / D * reach, third[1] + (m[1] - third[1]) / D * reach], .5 * r);
  }
  if (b.centre) centred(b.centre, mid, (three ? .55 : .7) * r);
}

function layoutConcentric(b: ConcentricBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn, roles: Roles): void {
  const w = out.w, side = b.labels === 'side', n = b.rings.length, lh = roles.note * LINE;
  const ordered = b.order === 'outer-first' ? b.rings : b.rings.toReversed(); // outermost first
  const R = side ? Math.min(200, w * .3) : Math.min(220, w * .42), radius = (i: number) => R * (n - i) / n;
  const keyW = w - 2 * R - 64;
  const keys = side ? ordered.map(r => t.wrap(ringLabel(r), keyW)) : [];
  // side keys: the rings and their keys are one block, set in the middle of the width (the circle's left edge was always 16px from the band's)
  const left = side ? Math.max(out.x + 8, g4(out.x + (w - (2 * R + 48 + Math.max(...keys.map(k => k.w)))) / 2)) : out.x + 16, keyLeft = left + 2 * R + 48;
  const keyH = keys.reduce((a, k) => a + k.h + 12, 0);
  out.h = Math.max(2 * R + 16, keyH + 16);
  const cx = g4(side ? left + R : out.x + w / 2), cy = g4(out.y + out.h / 2);
  const TONES: TextTone[] = ['accent', 'muted', 'danger', 'text'];
  ordered.forEach((ring, i) => {
    const rr = radius(i);
    out.primitives.push({k: 'circle', cx, cy, r: rr, tone: ring.tone ?? must(TONES[i % 4]), opacity: .10 + (i % 2) * .05, ...(i % 2 ? {dash: '7,5'} : {}), ...nodeOf(ring)});
    anchor(ring.id, {x: cx - rr, y: cy - rr, w: 2 * rr, h: 2 * rr});
  });
  if (side) {
    // the key, top to bottom from the outermost ring; each entry has a leader to a dot in its ring (on the ray to the upper right)
    const slot = (out.h - 16) / n;
    ordered.forEach((ring, i) => {
      const k = must(keys[i]), top = out.y + 8 + i * slot + (slot - k.h) / 2, ly = top + Math.min(k.h, lh) / 2;
      const rm = (radius(i) + (i < n - 1 ? radius(i + 1) : 0)) / 2, a = -Math.PI / 6, dot: Pt = [g4(cx + rm * Math.cos(a)), g4(cy + rm * Math.sin(a))];
      const part = partStep('callout', ring.id ?? i, ringLabel(ring)); // ADR 0054: the leader, its dot and the key
      out.primitives.push({k: 'path', d: `M${dot[0].toFixed(1)},${dot[1].toFixed(1)} L${(keyLeft - 8).toFixed(1)},${ly.toFixed(1)}`, tone: 'muted', thin: true, part});
      out.primitives.push({k: 'circle', cx: dot[0], cy: dot[1], r: 3.5, tone: 'text', opacity: 1, part});
      t.place(k, keyLeft, top, ring.tone ?? 'text', 'start', part);
    });
  }
  let innerBottom = -Infinity; // the bottom of the innermost ring's label: the centre text goes below it
  if (!side) {
    // each label is centred in the top of its own band (between its ring and the next one in); the width is the ring's chord
    // at the label's top edge, so a label that wraps to more lines is re-wrapped narrower
    ordered.forEach((ring, i) => {
      const rr = radius(i), mid = (rr + (i < n - 1 ? radius(i + 1) : 0)) / 2, chord = (h: number) => 2 * Math.sqrt(Math.max(0, rr * rr - (mid + h / 2) ** 2)) - 12;
      let k = t.wrap(ringLabel(ring), Math.max(60, chord(lh)));
      for (let tries = 0; tries < 3 && k.w > chord(k.h) && chord(k.h) >= 60; tries++) k = t.wrap(ringLabel(ring), chord(k.h));
      const top = cy - mid - k.h / 2;
      t.place(k, cx, top, ring.tone ?? 'text');
      innerBottom = top + k.h;
    });
  }
  if (b.centre) { const c = t.wrap(b.centre, Math.max(60, 1.4 * radius(n - 1))); t.place(c, cx, Math.max(cy - c.h / 2, innerBottom + 4)); }
}

// emblem: a word or two inside a circle, square, triangle, diamond, hexagon, trapezoid, parallelogram, pentagon-down, pill, rounded square, document or cylinder (outlines: emblem-shapes.ts). Each shape has a rectangle in it where text fits (a fraction of
// the shape's width D): the label is wrapped to that rectangle's width and the shape grows, in 8px steps and all to the same size, until
// every label (and its sub line) is inside its own rectangle. The text is then centred in that rectangle, so it never touches the outline.
const EMBLEM_MAX = 320, EMBLEM_WORD_MAX = 240;
const wordKind = (c: string | undefined): 'kana' | 'latin' | null => c === undefined ? null : /[ァ-ヺー-ヾｦ-ﾟ]/.test(c) ? 'kana' : /[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]/.test(c) ? 'latin' : null; // katakana (full and half width, and ー), alphanumerics (half and full width); not ・ (U+30FB): it separates words
/** Whether wrapping `text` into `lines` cuts a katakana (or alphanumeric) word: the two letters either side of a break touch in the source (no space, newline or ・ between them). */
function splitsWord(text: string, lines: readonly string[]): boolean {
  let at = 0, last: string | undefined;
  for (const line of lines) {
    const rest = text.slice(at), skipped = rest.length - rest.trimStart().length; // the source's own spaces / newlines before this line
    const kind = wordKind(last);
    if (last !== undefined && skipped === 0 && kind !== null && kind === wordKind(line[0])) return true;
    at += skipped;
    if (!text.startsWith(line, at)) return false; // the wrapper changed the text (it does not, today): say nothing rather than guess
    at += line.length;
    last = line.at(-1);
  }
  return false;
}

/** The label is written in the tone's own text colour, as a box does (accent / muted / danger; `new` and `changed` keep the normal text, so `accent` and `new` differ by it). */
const labelTone = (tone: EmphasisTone): TextTone => { const t = TONES[tone].text; return t === 'accent' || t === 'muted' || t === 'danger' ? t : 'text'; };

function layoutEmblem(b: EmblemBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void {
  const shapeOf = (i: EmblemItem): EmblemShape => i.shape ?? b.shape;
  const gap = g4(b.gap), widest = Math.min(EMBLEM_MAX, Math.floor(out.w / 8) * 8), least = Math.ceil((b.minSize ?? 96) / 8) * 8;
  if (least > widest) throw new Error(`emblem(): minSize ${b.minSize ?? 96} is wider than the band (${Math.round(out.w)}px) — lower \`minSize\` or widen the band`);
  const blocks = (d: number) => b.items.map(i => {
    const shape = shapeOf(i), g = EMBLEM_TEXT[shape], label = t.wrap(i.label, g.w * d), sub = i.sub ? t.wrap(i.sub, g.w * d, 400) : undefined;
    const textH = label.h + (sub?.h ?? 0), h = emblemHeight(shape, d, textH); // a shape in EMBLEM_FLEX grows taller for its lines; the others keep their height
    const fits = Math.max(label.w, sub?.w ?? 0) <= g.w * d + .5 && (EMBLEM_FLEX.has(shape) ? h <= emblemMaxHeight(shape, d) : textH <= g.h * d);
    return {label, sub, fits, h, whole: !splitsWord(i.label, label.lines) && !(sub && i.sub && splitsWord(i.sub, sub.lines))};
  });
  // The least D where everything fits and every katakana / alphanumeric word stays whole (up to EMBLEM_WORD_MAX, or 144px past a `minSize` that is already near it: the search must have room to run); a label that cannot be kept
  // whole even there (a very long word) is let off, so it does not spoil the others. Else the least D that fits, words cut.
  const wholeCap = Math.min(widest, Math.max(EMBLEM_WORD_MAX, least + EMBLEM_WORD_MAX - 96)), plans = new Map<number, ReturnType<typeof blocks>>();
  const planAt = (d: number) => { let p = plans.get(d); if (!p) plans.set(d, p = blocks(d)); return p; };
  // let off only a label that is whole at NO size from `least` to `wholeCap` (whether a long word is cut can depend on where the wrap happens to fall, so it is not monotone in D)
  const letOff = b.items.map((_i, n) => { for (let d = least; d <= wholeCap; d += 8) if (must(planAt(d)[n]).whole) return false; return true; });
  const solve = (whole: boolean, limit: number) => { for (let d = least; d <= limit; d += 8) { const plan = planAt(d); if (plan.every((p, n) => p.fits && (!whole || p.whole || letOff[n]))) return {d, plan}; } return undefined; };
  const found = solve(true, wholeCap) ?? solve(false, widest);
  if (!found) {
    const bad = must(b.items.find((_i, n) => !must(blocks(widest)[n]).fits)), shape = shapeOf(bad), flex = EMBLEM_FLEX.has(shape);
    // a shape in EMBLEM_FLEX grows taller, not wider, so a square (which holds fewer lines) is no way out for it
    const ways = flex ? 'shorten it' : `shorten it, move words to \`sub\`${shape === 'square' ? '' : ", or use shape: 'square'"}`;
    throw new Error(`emblem(): "${bad.label}"${bad.sub ? ` / "${bad.sub}"` : ''} does not fit in a ${shape} up to ${widest}px${widest < EMBLEM_MAX ? ' (the width of the band)' : ''} — ${ways}${widest < EMBLEM_MAX ? ', or widen the band' : ''}`);
  }
  const {d, plan} = found;
  const perRow = Math.max(1, Math.floor((out.w + gap) / (d + gap))), rows = Math.ceil(b.items.length / perRow);
  const rowH = Math.max(...plan.map(p => p.h));
  out.h = rows * rowH + (rows - 1) * gap;
  b.items.forEach((item, n) => {
    const row = Math.floor(n / perRow), inRow = Math.min(perRow, b.items.length - row * perRow), col = n - row * perRow;
    const rowW = inRow * d + (inRow - 1) * gap, shape = shapeOf(item);
    const k = must(plan[n]), h = k.h, left = g4(out.x + (out.w - rowW) / 2 + col * (d + gap)), top = g4(out.y + row * (rowH + gap) + (rowH - h) / 2);
    const o = emblemOutline(shape, left, top, d, h), tone = item.tone ?? 'plain';
    if (o.points) out.primitives.push({k: 'polygon', points: o.points, tone, ...nodeOf(item)});
    else if (o.path) out.primitives.push({k: 'path', d: o.path, tone: 'text', fill: tone, box: o.box, ...nodeOf(item)});
    else out.primitives.push({k: 'circle', cx: left + d / 2, cy: top + d / 2, r: d / 2, tone: 'text', fill: tone, ...nodeOf(item)});
    anchor(item.id, o.anchor);
    if (item.id) (out.bounds ??= []).push({id: item.id, x: left, y: top, w: d, h: o.h});
    const blockH = k.label.h + (k.sub?.h ?? 0), cx = left + d / 2, cy = top + o.textCy;
    t.place(k.label, cx, cy - blockH / 2, onItem(tone, labelTone(tone)));
    if (k.sub) t.place(k.sub, cx, cy - blockH / 2 + k.label.h, onItem(tone, 'muted'));
  });
}

// concentric with sectors (ADR 0065): the rings, from the centre out, cut into sectors from 12 o'clock clockwise. The sector names sit outside
// the rings, the ring names along the 12 o'clock cut. A mark is a dot with its label beside it: the dot starts at its share of its sector (the
// marks at one distance in one sector spread evenly) and the dot and label together take the nearest spot (along the dot's circle, and for a
// mark on a ring a little in or out within it) where the label crosses no line (ring, cut) and touches no other text or dot. Failing that,
// the nearest spot where it only crosses a line, which is reported (`crossings`). A mark with `from` gets a dotted ring where it was and an
// arrow to where it is now, and the key under the figure draws the two the same way.
const rectsHit = (a: Rect, b: Rect, m = 2): boolean => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
function layoutSectors(b: ConcentricBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void {
  const sectors = b.sectors ?? [], marks = b.marks ?? [];
  const w = out.w, n = b.rings.length, k = sectors.length;
  const inner1st = b.order === 'outer-first' ? b.rings.toReversed() : b.rings; // [0] is the innermost
  const secW = Math.min(150, Math.max(80, w * .18)), secs = sectors.map(s => t.wrap(s.label, secW)), secH = Math.max(...secs.map(x => x.h));
  const R = g4(Math.max(80, Math.min(240, (w - 2 * secW - 40) / 2))), pad = secH + 20;
  // the inner rings are a little wider than the outer ones (edges at ((i + 1) / n)^0.75 of the radius: a mark near the centre has room for its
  // label); when the centre's word needs more, the innermost ring holds it (up to 45% of the radius) and the others share the rest evenly
  const centre = b.centre ? t.wrap(b.centre, R * .7, 700) : undefined, need = centre ? Math.min(R * .45, Math.hypot(centre.w, centre.h) / 2 + 8) : 0;
  const inner = n === 1 ? R : Math.max(R * (1 / n) ** .75, need), widened = inner > R * (1 / n) ** .75;
  const edge = (i: number): number => i < 0 ? 0 : n === 1 ? R : widened ? inner + (R - inner) * i / (n - 1) : R * ((i + 1) / n) ** .75; // the outer edge of ring i
  const radius = (a: MarkAt): number => 'r' in a ? a.r * R : (edge(a.ring - 1) + edge(a.ring)) / 2;
  const cx = g4(out.x + w / 2), cy = g4(out.y + pad + R), a0 = -Math.PI / 2, span = 2 * Math.PI / k;
  const legendWords = marksLegend(b), legendH = legendWords ? 28 : 0;
  out.h = 2 * (pad + R) + legendH;
  const at = (a: number, r: number): Pt => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const f1 = (v: number) => v.toFixed(1);
  // the rings, outermost first: each a faint tint, so the centre reads darkest
  for (let i = n - 1; i >= 0; i--) {
    const ring = must(inner1st[i]), part = partStep('ring', ring.id ?? i, ring.label);
    out.primitives.push({k: 'circle', cx, cy, r: edge(i), tone: 'accent', opacity: .07, ...nodeOf(ring), part});
    anchor(ring.id, {x: cx - edge(i), y: cy - edge(i), w: 2 * edge(i), h: 2 * edge(i)}, part);
  }
  // the cuts between the sectors; with a centre word they start at the innermost ring (the word stands for the whole, and stays clear of them),
  // or, when there is only one ring, just outside the word
  const cutFrom = !centre ? 0 : n === 1 ? need : edge(0);
  const cuts: [Pt, Pt][] = k > 1 ? Array.from({length: k}, (_v, i) => [at(a0 + i * span, cutFrom), at(a0 + i * span, R)] as [Pt, Pt]) : [];
  for (const [[x1, y1], [x2, y2]] of cuts) out.primitives.push({k: 'path', d: `M${f1(x1)},${f1(y1)} L${f1(x2)},${f1(y2)}`, tone: 'muted', thin: true});
  sectors.forEach((s, i) => {
    const am = k === 1 ? a0 : a0 + (i + .5) * span, c = Math.cos(am), sn = Math.sin(am), [px, py] = at(am, R + 12), blk = must(secs[i]);
    const side: FlowText['anchor'] = c > .3 ? 'start' : c < -.3 ? 'end' : 'middle', top = sn < -.3 ? py - blk.h : sn > .3 ? py : py - blk.h / 2;
    const part = partStep('sector', s.id ?? i, s.label);
    t.place(blk, px, top, 'text', side, part);
    anchor(s.id, {x: side === 'middle' ? px - blk.w / 2 : side === 'start' ? px : px - blk.w, y: top, w: blk.w, h: blk.h}, part);
  });
  inner1st.forEach((ring, i) => {
    if (!ring.label) return;
    const blk = t.wrap(ring.label, Math.max(60, R * .6), 400), mid = radius({ring: i});
    t.place(blk, cx + 6, cy - mid - blk.h / 2, ring.tone ?? 'muted', 'start', partStep('ring', ring.id ?? i, ring.label));
  });
  if (centre) t.place(centre, cx, cy - centre.h / 2);
  // what a mark's label must not touch: every text so far (the ring names with room to spare) and every dot; what it should not cross: the lines
  const busy: Rect[] = out.labelBoxes.map(r => ({x: r.x - 4, y: r.y - 2, w: r.w + 8, h: r.h + 4}));
  const crossesRing = (r: Rect) => {
    const near = Math.hypot(Math.max(r.x - cx, 0, cx - r.x - r.w), Math.max(r.y - cy, 0, cy - r.y - r.h));
    const far = Math.max(...[[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].map(([x, y]) => Math.hypot(must(x) - cx, must(y) - cy)));
    return Array.from({length: n}, (_v, i) => edge(i)).some(e => e > near - 2 && e < far + 2);
  };
  const crossesCut = (r: Rect) => cuts.some(([p, q]) => { for (let u = 0; u <= 1; u += 1 / 64) { const x = p[0] + (q[0] - p[0]) * u, y = p[1] + (q[1] - p[1]) * u; if (x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2) return true; } return false; });
  const inside = (r: Rect) => r.x >= out.x && r.x + r.w <= out.x + w && r.y >= out.y && r.y + r.h <= out.y + out.h - legendH;
  const labelSides = (blk: ReturnType<Texts['wrap']>, px: number, py: number, right: boolean) => {
    const sides: {x: number; top: number; anchor: FlowText['anchor']; box: Rect}[] = [
      {x: px + 10, top: py - blk.h / 2, anchor: 'start', box: {x: px + 10, y: py - blk.h / 2, w: blk.w, h: blk.h}},
      {x: px - 10, top: py - blk.h / 2, anchor: 'end', box: {x: px - 10 - blk.w, y: py - blk.h / 2, w: blk.w, h: blk.h}},
      {x: px, top: py - 9 - blk.h, anchor: 'middle', box: {x: px - blk.w / 2, y: py - 9 - blk.h, w: blk.w, h: blk.h}},
      {x: px, top: py + 9, anchor: 'middle', box: {x: px - blk.w / 2, y: py + 9, w: blk.w, h: blk.h}},
      {x: px + 7, top: py - 7 - blk.h, anchor: 'start', box: {x: px + 7, y: py - 7 - blk.h, w: blk.w, h: blk.h}},
      {x: px - 7, top: py - 7 - blk.h, anchor: 'end', box: {x: px - 7 - blk.w, y: py - 7 - blk.h, w: blk.w, h: blk.h}},
      {x: px + 7, top: py + 7, anchor: 'start', box: {x: px + 7, y: py + 7, w: blk.w, h: blk.h}},
      {x: px - 7, top: py + 7, anchor: 'end', box: {x: px - 7 - blk.w, y: py + 7, w: blk.w, h: blk.h}},
    ];
    // right, left, above, below, then the corners — the side away from the centre first
    return (right ? [0, 1, 2, 3, 4, 6, 5, 7] : [1, 0, 2, 3, 5, 7, 4, 6]).map(i => must(sides[i]));
  };
  type Spot = {a: number; r: number; px: number; py: number; side: ReturnType<typeof labelSides>[number]; crossing: boolean};
  const placed: (Spot & {m: ConcentricPlaced; mi: number; blk: ReturnType<Texts['wrap']>; from?: Pt})[] = [];
  // where a mark was in another sector is a fixed spot (the middle of that sector at its distance): no dot is put there
  const wasAt = (m: ConcentricPlaced, a: number): Pt | undefined => m.from ? at(m.from.sector === m.sector ? a : a0 + span * (m.from.sector + .5), radius(m.from.at)) : undefined;
  for (const m of marks) if (m.from && m.from.sector !== m.sector) { const [x, y] = must(wasAt(m, 0)); busy.push({x: x - 8, y: y - 8, w: 16, h: 16}); }
  marks.forEach((m, mi) => {
    const same = (x: ConcentricPlaced) => x.sector === m.sector && ('ring' in x.at ? 'ring' in m.at && x.at.ring === m.at.ring : 'r' in m.at && x.at.r === m.at.r);
    const mine = marks.filter(same), j = mine.indexOf(m), lo = a0 + span * m.sector, hi = lo + span, home = radius(m.at);
    const ideal = lo + span * (j + 1) / (mine.length + 1), ring = 'ring' in m.at ? m.at.ring : undefined;
    // a mark on a ring may move within 30% of the ring's width; a mark at r, 8% of the radius (r is where it is about)
    const band = ring === undefined ? R * .08 : (edge(ring) - edge(ring - 1)) * .3;
    // the label on one line, or failing that (clear of every line) on two narrower ones
    const wide = t.wrap(m.label, 130, 400), narrow = t.wrap(m.label, Math.max(56, wide.w * .55), 400), blocks = narrow.lines.length > wide.lines.length && narrow.lines.length <= 3 ? [wide, narrow] : [wide];
    let best: (Spot & {blk: typeof wide}) | undefined;
    // the nearest spot first: along the circle (both ways), then a little in and out within the ring
    search: for (const [strict, blk] of [...blocks.map(x => [true, x] as const), [false, wide] as const]) for (const dr of [0, band / 2, -band / 2, band, -band]) {
      const r = Math.max(0, home + dr), step = r > 0 ? Math.min(.2, 8 / r) : Math.PI;
      for (let i = 0; i < 60; i++) {
        const a = ideal + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * step;
        if (k > 1 && (a < lo + .03 || a > hi - .03)) continue;
        const [x, y] = at(a, r), px = g4(x), py = g4(y), dot = {x: px - 8, y: py - 8, w: 16, h: 16};
        if (busy.some(o => rectsHit(o, dot, 0))) continue;
        // its own move: the label keeps off the arrow from where it was (the line between the two dots); and, while it can, the dotted ring
        // and the arrow keep off the other marks' dots and labels (a ring on another mark's dot would read as that mark's move)
        const was = wasAt(m, a);
        const trail: Rect[] = was ? Array.from({length: 9}, (_v, q) => ({x: was[0] + (px - was[0]) * q / 8 - 5, y: was[1] + (py - was[1]) * q / 8 - 5, w: 10, h: 10})) : [];
        if (strict && was && m.from?.sector === m.sector && busy.some(o => rectsHit(o, {x: was[0] - 8, y: was[1] - 8, w: 16, h: 16}, 0))) continue;
        if (strict && trail.slice(1, -1).some(tr => busy.some(o => rectsHit(o, tr, 0)))) continue;
        for (const side of labelSides(blk, px, py, Math.cos(a) >= 0 || r === 0)) {
          if (!inside(side.box) || busy.some(o => rectsHit(o, side.box)) || rectsHit(side.box, dot, 0) || trail.some(o => rectsHit(o, side.box, 0))) continue;
          const crossing = crossesRing(side.box) || crossesCut(side.box);
          if (strict && crossing) continue;
          best = {a, r, px, py, side, crossing, blk};
          break search;
        }
      }
    }
    const spot = best ?? (() => { const [x, y] = at(ideal, home), px = g4(x), py = g4(y); return {a: ideal, r: home, px, py, side: must(labelSides(wide, px, py, true)[0]), crossing: true, blk: wide}; })();
    busy.push({x: spot.px - 8, y: spot.py - 8, w: 16, h: 16}, spot.side.box);
    const from = wasAt(m, spot.a);
    // where it was, and the arrow from there, are taken too: a later dot beside the arrow would read as the one that moved
    if (from) for (let q = 0; q <= 1; q += .125) busy.push({x: from[0] + (spot.px - from[0]) * q - 8, y: from[1] + (spot.py - from[1]) * q - 8, w: 16, h: 16});
    placed.push({...spot, m, mi, ...(from ? {from} : {})});
  });
  const moved = (fx: number, fy: number, px: number, py: number, part: string) => {
    out.primitives.push({k: 'circle', cx: fx, cy: fy, r: 5, tone: 'muted', opacity: .15, dash: '2,2', part});
    const d = Math.hypot(px - fx, py - fy);
    if (d > 20) { const ux = (px - fx) / d, uy = (py - fy) / d; out.primitives.push({k: 'path', d: `M${f1(fx + ux * 7)},${f1(fy + uy * 7)} L${f1(px - ux * 9)},${f1(py - uy * 9)}`, tone: 'muted', arrow: true, part}); }
  };
  for (const p of placed) if (p.from) moved(p.from[0], p.from[1], p.px, p.py, partStep('mark', p.m.id ?? p.mi, p.m.label));
  for (const p of placed) {
    const part = partStep('mark', p.m.id ?? p.mi, p.m.label);
    out.primitives.push({k: 'circle', cx: p.px, cy: p.py, r: 6, tone: p.m.tone, opacity: 1, ...nodeOf(p.m), part});
    anchor(p.m.id, {x: p.px - 6, y: p.py - 6, w: 12, h: 12}, part);
    t.place(p.blk, p.side.x, p.side.top, p.m.tone === 'muted' ? 'muted' : 'text', p.side.anchor, part);
    if (p.crossing) (out.crossings ??= []).push(p.m.label);
  }
  // the key, drawn as the figure draws it: the dotted ring and its word, an arrow, the dot and its word
  if (legendWords) {
    const [was, now] = legendWords, part = partStep('legend', 0, `${was} ${now}`), y = g4(out.y + out.h - 12), top = y - t.lineH() / 2;
    const ww = t.width(was, 400), nw = t.width(now, 400), total = 10 + 6 + ww + 10 + 28 + 10 + 12 + 6 + nw;
    let x = cx - total / 2;
    out.primitives.push({k: 'circle', cx: x + 5, cy: y, r: 5, tone: 'muted', opacity: .15, dash: '2,2', part});
    t.place(t.wrap(was, ww + 4, 400), x + 16, top, 'muted', 'start', part);
    x += 16 + ww + 10;
    out.primitives.push({k: 'path', d: `M${f1(x)},${y} L${f1(x + 28)},${y}`, tone: 'muted', arrow: true, part});
    x += 28 + 10;
    out.primitives.push({k: 'circle', cx: x + 6, cy: y, r: 6, tone: 'accent', opacity: 1, part});
    t.place(t.wrap(now, nw + 4, 400), x + 18, top, 'muted', 'start', part);
  }
}

// cycle with links (ADR 0065): the steps on a regular polygon (an even count with a flat top, an odd one with a point up; four make a square);
// every link a straight line between the circles, two-way as two arrows that meet in the middle. The centre's word sits on a disc of its own,
// over the links that cross the middle. A link's label goes beside the link where it touches no other link, circle or label.
function layoutLinked(b: CycleBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn, roles: Roles): void {
  const w = out.w, n = b.steps.length, links = b.links ?? [];
  type Block = {label: ReturnType<Texts['wrap']>; sub?: ReturnType<Texts['wrap']>};
  // the least circle (from 48px, in 4px steps) where every label and sub line is one line; failing that by 76px, the least where they fit wrapped
  // (two lines in a circle have its chord at their edge, about 1.75 r wide; more lines get 1.5 r)
  const blocksAt = (r: number, f: number): Block[] => b.steps.map(x => ({label: t.wrap(x.label, r * f), ...(x.sub ? {sub: t.wrap(x.sub, r * f, 400)} : {})}));
  const fits = (k: Block, r: number, f: number) => Math.max(k.label.w, k.sub?.w ?? 0) <= r * f + .5 && k.label.h + (k.sub?.h ?? 0) <= r * 1.4;
  const oneLine = (k: Block) => k.label.lines.length === 1 && (k.sub?.lines.length ?? 1) === 1;
  let nr = 48, blocks = blocksAt(nr, 1.75);
  while (nr < 76 && !blocks.every(k => fits(k, nr, 1.75) && oneLine(k))) blocks = blocksAt(nr += 4, 1.75);
  if (!blocks.every(k => fits(k, nr, 1.75) && oneLine(k))) for (nr = 48, blocks = blocksAt(nr, 1.5); nr < 84 && !blocks.every(k => fits(k, nr, 1.5)); ) blocks = blocksAt(nr += 4, 1.5);
  const centre = b.centre ? t.wrap(b.centre, 140, 700, roles.label) : undefined, centreR = centre ? Math.max(centre.w, centre.h) / 2 + 14 : 0;
  const sinN = Math.sin(Math.PI / n), labelled = links.some(l => l.label) ? 40 : 0;
  const R = Math.max((nr + 44 + labelled / 2) / sinN, n >= 5 ? (nr + 16) / (1 - Math.cos(2 * Math.PI / n)) : 0, centre ? nr + centreR + 40 : 0, 110);
  // a regular polygon: never squeezed (circles would overlap) — a band too narrow for it is an error
  if (w / 2 < R + nr + 12) throw new Error(`cycle(): with links, ${n} steps need a band at least ${Math.ceil(2 * (R + nr + 12))}px wide (got ${Math.round(w)}px) — widen it, shorten the labels, or use fewer steps`);
  const Rx = R, Ry = R;
  const a0 = n % 2 ? -Math.PI / 2 : -Math.PI / 2 - Math.PI / n, ang = (i: number) => a0 + 2 * Math.PI * i / n;
  const sins = b.steps.map((_x, i) => Math.sin(ang(i))), up = -Math.min(...sins) * Ry + nr, down = Math.max(...sins) * Ry + nr;
  const cx = g4(out.x + w / 2), cy = g4(out.y + 8 + up);
  out.h = cy + down + 8 - out.y;
  const pos: Pt[] = b.steps.map((_x, i) => [g4(cx + Rx * Math.cos(ang(i))), g4(cy + Ry * Math.sin(ang(i)))]);
  const stepPart = (i: number): string => partStep('step', b.steps[i]?.id ?? i, b.steps[i]?.label ?? '');
  const f1 = (v: number) => v.toFixed(1), mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const toward = (p: Pt, q: Pt, d: number): Pt => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [p[0] + (q[0] - p[0]) / L * d, p[1] + (q[1] - p[1]) / L * d]; };
  const segs = links.map(l => { const p = must(pos[l.from]), q = must(pos[l.to]); return {p, q, s: toward(p, q, nr + 6), e: toward(q, p, nr + 6)}; });
  links.forEach((l, li) => {
    const {s: st, e} = must(segs[li]), m = mid(st, e), part = partStep('link', li, l.label ?? '');
    // two-way: two arrows that leave the middle (a link through the centre's word meets under its disc)
    if (l.both) for (const end of [e, st]) out.primitives.push({k: 'path', d: `M${f1(m[0])},${f1(m[1])} L${f1(end[0])},${f1(end[1])}`, tone: 'text', arrow: true, part});
    else out.primitives.push({k: 'path', d: `M${f1(st[0])},${f1(st[1])} L${f1(e[0])},${f1(e[1])}`, tone: 'text', arrow: true, part});
  });
  // the labels: beside their link, at its middle or further along, on either side; the first spot clear of every other link, every circle,
  // the centre's disc and the labels placed so far (else the middle, away from the centre)
  const taken: Rect[] = [];
  const clear = (r: Rect, li: number) => !taken.some(o => r.x < o.x + o.w + 2 && o.x < r.x + r.w + 2 && r.y < o.y + o.h + 2 && o.y < r.y + r.h + 2)
    && !pos.some(c => Math.hypot(Math.max(r.x - c[0], 0, c[0] - r.x - r.w), Math.max(r.y - c[1], 0, c[1] - r.y - r.h)) < nr + 2)
    && !(centre && Math.hypot(Math.max(r.x - cx, 0, cx - r.x - r.w), Math.max(r.y - cy, 0, cy - r.y - r.h)) < centreR + 2)
    && !segs.some((g, gi) => gi !== li && Array.from({length: 33}, (_v, u) => [g.s[0] + (g.e[0] - g.s[0]) * u / 32, g.s[1] + (g.e[1] - g.s[1]) * u / 32]).some(([x, y]) => must(x) > r.x - 2 && must(x) < r.x + r.w + 2 && must(y) > r.y - 2 && must(y) < r.y + r.h + 2));
  links.forEach((l, li) => {
    if (!l.label) return;
    const {p, q, s: st, e} = must(segs[li]), L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, nx = -(q[1] - p[1]) / L, ny = (q[0] - p[0]) / L;
    const blk = t.wrap(l.label, 120, 400), d = Math.abs(nx) * blk.w / 2 + Math.abs(ny) * blk.h / 2 + 6;
    const cands: {x: number; y: number}[] = [];
    for (const u of [.5, .35, .65, .25, .75]) {
      const lp: Pt = [st[0] + (e[0] - st[0]) * u, st[1] + (e[1] - st[1]) * u], away = (lp[0] - cx) * nx + (lp[1] - cy) * ny >= 0 ? 1 : -1;
      for (const side of [away, -away]) cands.push({x: lp[0] + nx * side * d, y: lp[1] + ny * side * d - blk.h / 2});
    }
    const boxOf = (c: {x: number; y: number}): Rect => ({x: c.x - blk.w / 2, y: c.y, w: blk.w, h: blk.h});
    const c = cands.find(x => clear(boxOf(x), li)) ?? must(cands[0]);
    taken.push(boxOf(c));
    t.place(blk, c.x, c.y, 'muted', 'middle', partStep('link', li, l.label));
  });
  b.steps.forEach((x, i) => {
    const [px, py] = must(pos[i]), k = must(blocks[i]), part = stepPart(i);
    const tone: TextTone = x.tone === 'danger' || x.tone === 'removed' ? 'danger' : x.tone === 'muted' ? 'muted' : 'accent';
    out.primitives.push({k: 'circle', cx: px, cy: py, r: nr, tone, ...(isSolidTone(x.tone) ? {fill: x.tone} : {}), ...nodeOf(x), part});
    anchor(x.id, {x: px - nr, y: py - nr, w: 2 * nr, h: 2 * nr}, part);
    const top = py - (k.label.h + (k.sub?.h ?? 0)) / 2;
    t.place(k.label, px, top, onItem(x.tone, 'text'), 'middle', part);
    if (k.sub) t.place(k.sub, px, top + k.label.h, onItem(x.tone, 'muted'), 'middle', part);
  });
  if (centre) {
    out.primitives.push({k: 'circle', cx, cy, r: g4(centreR), tone: 'text', fill: 'plain'});
    t.place(centre, cx, cy - centre.h / 2);
  }
}

/** ADR 0065: a named frame round a figure, as wide as what it holds (and its name): the figure is laid out under the name, then framed. */
function framed(name: string | undefined, out: LaidOutFlowShape, t: Texts, lay: () => void): void {
  if (!name) { lay(); return; }
  const blk = t.wrap(name, out.w - 40), top = out.y, head = blk.h + 20;
  out.y = top + head;
  lay();
  out.y = top;
  out.h += head + 16;
  // the extent of what was drawn (texts and shapes), padded; never narrower than the name
  const xs = [...out.texts.map(x => [x.x, x.x + x.w]), ...out.primitives.flatMap(p => p.k === 'circle' ? [[p.cx - p.r, p.cx + p.r]] : p.k === 'polygon' ? [[Math.min(...p.points.map(q => q[0])), Math.max(...p.points.map(q => q[0]))]] : [])].flat();
  const mid = out.x + out.w / 2, half = Math.min(out.w / 2 - 4, Math.max(Math.max(...xs.map(x => Math.abs(x - mid))) + 32, blk.w / 2 + 24));
  const fx = g4(mid - half), fy = g4(top + 4);
  out.primitives.push({k: 'rect', x: fx, y: fy, w: g4(mid + half) - fx, h: g4(top + out.h - 4) - fy, tone: 'muted'});
  t.place(blk, fx + 16, top + 12, 'muted', 'start', partStep('frame', 0, name));
}
