// flowShapes: the stock business figures drawn as one band each — chevron (process arrows), funnel (narrowing stages), cycle
// (a closed loop of nodes), venn (2 or 3 sets), concentric (nested rings) and emblem (a word or two inside a circle / triangle / ...). Everything is placed by this file:
//   * every text is wrapped to the room its shape gives it, and flowShapeTexts() registers exactly the texts / sizes / weights
//     the layout draws (an unregistered atom would measure 0 wide),
//   * cycle arrows run along the ring between the nodes (they never cross a node or its label),
//   * venn labels sit in their own region (a pair's label in the part only that pair shares, not in the middle),
//   * a side key of concentric() is tied to its ring by a leader line, so the key does not depend on colour.
// verify.ts checks that every label stays inside the figure and that no two labels overlap.
import {resolveLoopBacks} from './loop-back.ts';
import type {LoopBack} from './types/containers.ts';
import {assertScope} from './scope-name.ts';
import {textWidth} from './atoms.ts';
import {wrapText} from './wrap.ts';
import {katakanaWidth} from './tree.ts';
import type {Anchor, Dimmed, FontFamily, Rect, RevealOpts, ScopeOpts, Roles, TextTone, WidthOf, WrapMode} from './types/core.ts';
import type {BoxTone} from './types/text-bands.ts';

import {must} from './must.ts';
export interface FlowStep {label: string; sub?: string; id?: string; tone?: BoxTone}
export interface ChevronOpts extends RevealOpts, ScopeOpts {/** The arrows back to earlier steps, drawn under a horizontal chevron: `{from: 4, to: 2, label}` (1-based numbers or item ids). Several loops must nest. */ loopBack?: LoopBack | readonly LoopBack[]; id?: string; direction?: 'horizontal' | 'vertical'; first?: 'pentagon' | 'chevron'; gap?: number; current?: number; highlight?: number; width?: number}
export interface FunnelStage {label: string; value?: number; id?: string; tone?: BoxTone}
export interface FunnelOpts extends RevealOpts, ScopeOpts {id?: string; scale?: 'value' | 'even'; showRate?: boolean; width?: number}
export interface CycleOpts extends RevealOpts, ScopeOpts {id?: string; centre?: string; direction?: 'cw' | 'ccw'; width?: number}
export interface VennSet {name: string; label?: string; id?: string; tone?: TextTone}
export interface VennOverlap {sets: readonly string[]; label: string}
export interface VennOpts extends RevealOpts, ScopeOpts {id?: string; overlaps?: readonly VennOverlap[]; centre?: string; universe?: string | boolean; width?: number}
export interface ConcentricRing {label: string; description?: string; id?: string; tone?: TextTone}
export type EmblemKind = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon';
export interface EmblemItem {label: string; sub?: string; kind?: EmblemKind; id?: string; tone?: BoxTone}
export interface EmblemOpts extends RevealOpts, ScopeOpts {id?: string; /** The shape of every item that does not name its own. */ kind?: EmblemKind; gap?: number; /** The least width of a shape (the shapes grow to hold their text, all to the same size). */ size?: number; width?: number}
export interface ConcentricOpts extends RevealOpts, ScopeOpts {id?: string; order?: 'outer-first' | 'inner-first'; labels?: 'inside' | 'side'; centre?: string; width?: number}

export interface ChevronBand extends ChevronOpts {type: 'chevron'; steps: FlowStep[]; direction: 'horizontal' | 'vertical'; first: 'pentagon' | 'chevron'; gap: number}
export interface FunnelBand extends FunnelOpts {type: 'funnel'; stages: FunnelStage[]; scale: 'value' | 'even'; showRate: boolean}
export interface CycleBand extends CycleOpts {type: 'cycle'; steps: FlowStep[]; direction: 'cw' | 'ccw'}
export interface VennBand extends VennOpts {type: 'venn'; sets: VennSet[]; overlaps: VennOverlap[]}
export interface ConcentricBand extends ConcentricOpts {type: 'concentric'; rings: ConcentricRing[]; order: 'outer-first' | 'inner-first'; labels: 'inside' | 'side'}
export interface EmblemBand extends EmblemOpts {type: 'emblem'; items: EmblemItem[]; kind: EmblemKind; gap: number}
export type FlowShapeBand = ChevronBand | FunnelBand | CycleBand | VennBand | ConcentricBand | EmblemBand;

export interface FlowText extends Rect {text: string; tx: number; ty: number; size: number; weight: 400 | 700; anchor: 'start' | 'middle' | 'end'; tone: TextTone}
export type FlowPrimitive =
  | ({k: 'polygon'; points: [number, number][]; tone: BoxTone; strong?: boolean} & Dimmed)
  | ({k: 'circle'; cx: number; cy: number; r: number; tone: TextTone; opacity?: number; dash?: string; /** Drawn as a box of this tone (filled, outlined) instead of a tinted ring. */ fill?: BoxTone} & Dimmed)
  | ({k: 'rect'; x: number; y: number; w: number; h: number; tone: TextTone} & Dimmed)
  | ({k: 'path'; d: string; tone: TextTone; arrow?: boolean; thin?: boolean} & Dimmed);
export interface LaidOutFlowShape extends Rect, Dimmed {type: FlowShapeBand['type']; id?: string; reveal?: number; until?: number; primitives: FlowPrimitive[]; texts: FlowText[]; anchors: Anchor[]; labelBoxes: (Rect & {label: string})[]; /** emblem: the bounding box of each shape that has an id (the checks' obstacle, which may be larger than its anchor). */ bounds?: Anchor[]}

// ---------------------------------------------------------------------------------------------------------------------------
// constructors (validation)
// ---------------------------------------------------------------------------------------------------------------------------

const BOX_TONES: ReadonlySet<string> = new Set<string>(['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger']);
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
function checkTones(name: string, xs: readonly {tone?: string}[], allowed: ReadonlySet<string>): void {
  xs.forEach((x, i) => { if (x.tone && !allowed.has(x.tone)) throw new Error(`${name}(): item ${i + 1} has unknown tone "${x.tone}" (${[...allowed].join(' | ')})`); });
}

export function chevronBand(steps: readonly FlowStep[], opts: ChevronOpts = {}): ChevronBand {
  common('chevron', steps, opts.id);
  assertScope(opts.scope, 'chevron()');
  checkTones('chevron', steps, BOX_TONES);
  const current = opts.current ?? opts.highlight;
  if (current !== undefined && (!Number.isInteger(current) || current < 0 || current >= steps.length)) throw new Error(`chevron(): current/highlight must be a zero-based step index (0..${steps.length - 1})`);
  if (opts.gap !== undefined && !(opts.gap >= 0)) throw new Error('chevron(): gap must be >= 0');
  if (opts.loopBack !== undefined && (opts.direction ?? 'horizontal') !== 'horizontal') throw new Error("chevron({direction: 'vertical'}): loopBack is for horizontal flows (a vertical chevron has no room under it)");
  const loopBack = opts.loopBack === undefined ? undefined : resolveLoopBacks('chevron()', opts.loopBack, steps.length, steps.map(s => s.id));
  return {...opts, ...(loopBack ? {loopBack} : {}), type: 'chevron', steps: [...steps], direction: opts.direction ?? 'horizontal', first: opts.first ?? 'pentagon', gap: opts.gap ?? 4};
}
export function funnelBand(stages: readonly FunnelStage[], opts: FunnelOpts = {}): FunnelBand {
  common('funnel', stages, opts.id);
  assertScope(opts.scope, 'funnel()');
  checkTones('funnel', stages, BOX_TONES);
  stages.forEach((s, i) => { if (s.value !== undefined && (!Number.isFinite(s.value) || s.value < 0)) throw new Error(`funnel(): stage ${i + 1} value must be a finite number >= 0`); });
  const scale = opts.scale ?? 'even';
  if (scale === 'value' && stages.some(s => s.value === undefined)) throw new Error('funnel(): scale "value" requires a value on every stage');
  return {...opts, type: 'funnel', stages: [...stages], scale, showRate: opts.showRate ?? false};
}
export function cycleBand(steps: readonly FlowStep[], opts: CycleOpts = {}): CycleBand {
  if (steps.length < 3 || steps.length > 8) throw new Error(`cycle(): needs 3..8 steps (got ${steps.length})`);
  common('cycle', steps, opts.id);
  assertScope(opts.scope, 'cycle()');
  checkTones('cycle', steps, BOX_TONES);
  return {...opts, type: 'cycle', steps: [...steps], direction: opts.direction ?? 'cw'};
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
export function concentricBand(rings: readonly ConcentricRing[], opts: ConcentricOpts = {}): ConcentricBand {
  common('concentric', rings, opts.id);
  assertScope(opts.scope, 'concentric()');
  checkTones('concentric', rings, TEXT_TONES);
  return {...opts, type: 'concentric', rings: [...rings], order: opts.order ?? 'outer-first', labels: opts.labels ?? 'inside'};
}
const EMBLEM_KINDS: ReadonlySet<string> = new Set<string>(['circle', 'square', 'triangle', 'diamond', 'hexagon']);
export function emblemBand(items: readonly EmblemItem[], opts: EmblemOpts = {}): EmblemBand {
  common('emblem', items, opts.id);
  assertScope(opts.scope, 'emblem()');
  checkTones('emblem', items, BOX_TONES);
  for (const k of [opts.kind, ...items.map(i => i.kind)]) if (k !== undefined && !EMBLEM_KINDS.has(k)) throw new Error(`emblem(): unknown kind "${String(k)}" (${[...EMBLEM_KINDS].join(' | ')})`);
  if (opts.gap !== undefined && !(opts.gap >= 0)) throw new Error('emblem(): gap must be >= 0');
  if (opts.size !== undefined && !(opts.size >= 64 && opts.size <= EMBLEM_MAX)) throw new Error(`emblem(): size must be 64..${EMBLEM_MAX}`);
  return {...opts, type: 'emblem', items: [...items], kind: opts.kind ?? 'circle', gap: opts.gap ?? 16};
}

export const flowShapeIds = (b: FlowShapeBand): string[] => (b.type === 'funnel' ? b.stages : b.type === 'venn' ? b.sets : b.type === 'concentric' ? b.rings : b.type === 'emblem' ? b.items : b.steps).flatMap(x => x.id ? [x.id] : []);

// ---------------------------------------------------------------------------------------------------------------------------
// texts: what the layout draws, at the size and weight it draws them (registered for measuring before layout)
// ---------------------------------------------------------------------------------------------------------------------------

type TextSpec = [text: string, size: number, weight: 400 | 700];
const funnelLabel = (s: FunnelStage): string => s.value === undefined ? s.label : `${s.label}  ${s.value}`;
const funnelRate = (prev: number | undefined, v: number | undefined): string | undefined => prev && v !== undefined ? `${Math.round(v / prev * 100)}%` : undefined;
const ringLabel = (r: ConcentricRing): string => r.description ? `${r.label} — ${r.description}` : r.label;

function textSpecs(b: FlowShapeBand, roles: Roles): TextSpec[] {
  const bold = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 700]] : [];
  const plain = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 400]] : [];
  switch (b.type) {
    case 'chevron': return b.steps.flatMap(s => [...bold(s.label), ...plain(s.sub)]);
    case 'cycle': return [...b.steps.flatMap(s => [...bold(s.label), ...plain(s.sub)]), ...(b.centre ? [[b.centre, roles.label, 700] as TextSpec] : [])];
    case 'funnel': return b.stages.flatMap((s, i) => [...bold(funnelLabel(s)), ...(b.showRate && i ? plain(funnelRate(must(b.stages[i - 1]).value, s.value)) : [])]);
    case 'venn': return [...b.sets.flatMap(s => bold(s.label ?? s.name)), ...b.overlaps.flatMap(o => bold(o.label)), ...bold(b.centre), ...plain(typeof b.universe === 'string' ? b.universe : undefined)];
    case 'concentric': return [...b.rings.flatMap(r => bold(ringLabel(r))), ...bold(b.centre)];
    case 'emblem': return b.items.flatMap(i => [...bold(i.label), ...plain(i.sub)]);
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
  const anchor = (id: string | undefined, r: Rect) => { if (id) out.anchors.push({id, ...r}); };
  switch (b.type) {
    case 'chevron': layoutChevron(b, out, t, anchor); break;
    case 'funnel': layoutFunnel(b, out, t, anchor, roles); break;
    case 'cycle': layoutCycle(b, out, t, anchor, roles); break;
    case 'venn': layoutVenn(b, out, t, anchor); break;
    case 'concentric': layoutConcentric(b, out, t, anchor, roles); break;
    case 'emblem': layoutEmblem(b, out, t, anchor); break;
  }
  return out;
}
type AnchorFn = (id: string | undefined, r: Rect) => void;

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
  /** Places a wrapped block with its top at `top`; `x` is its centre (middle), left edge (start) or right edge (end). */
  place(block: ReturnType<Texts['wrap']>, x: number, top: number, tone: TextTone = 'text', anchor: FlowText['anchor'] = 'middle'): void {
    const {size, weight} = block;
    block.lines.forEach((line, i) => {
      const tw = textWidth(this.widthOf, line, size, weight), ty = top + i * size * LINE + size * ((LINE - 1.2) / 2 + 1); // the glyph box (1.2 sizes) centred in its line
      const left = anchor === 'middle' ? x - tw / 2 : anchor === 'start' ? x : x - tw;
      const box = {x: left, y: ty - size, w: tw, h: size * 1.2};
      this.out.texts.push({text: line, tx: x, ty, size, weight, anchor, tone, ...box});
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
    out.primitives.push({k: 'polygon', points, tone: current === i ? 'accent' : s.tone ?? 'plain', ...(current === i ? {strong: true} : {})});
    anchor(s.id, {x: xx, y: yy, w: cellW, h: cellH});
    const k = must(blocks[i]), top = yy + (cellH - (vertical ? tip : 0) - textH(k)) / 2;
    t.place(k.label, xx + cellW / 2, top);
    if (k.sub) t.place(k.sub, xx + cellW / 2, top + k.label.h, 'muted');
  });
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
    out.primitives.push({k: 'polygon', points: [[cx - a / 2, yy], [cx + a / 2, yy], [cx + z / 2, yy + rowH - 4], [cx - z / 2, yy + rowH - 4]], tone: s.tone ?? (i % 2 ? 'muted' : 'accent')});
    anchor(s.id, {x: cx - Math.max(a, z) / 2, y: yy, w: Math.max(a, z), h: rowH - 4});
    const blockH = p.label.h + (p.rate && !p.rateLeft ? p.rate.h : 0), top = yy + (rowH - 4 - blockH) / 2;
    const lx = p.beside ? p.sideLeft : cx, la = p.beside ? 'start' : 'middle';
    t.place(p.label, lx, top, 'text', la);
    if (p.rate) {
      if (p.rateLeft) t.place(p.rate, cx - Math.max(a, z) / 2 - 14, yy + (rowH - 4 - lh) / 2, 'muted', 'end');
      else t.place(p.rate, lx, top + p.label.h, 'muted', la);
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
  b.steps.forEach((_s, i) => {
    const [p, q] = [at(angle(i) + sign * skip), at(angle(i + 1) - sign * skip)];
    out.primitives.push({k: 'path', d: `M${r1(p[0])},${r1(p[1])} A${r1(R)},${r1(R)} 0 0 ${sign > 0 ? 1 : 0} ${r1(q[0])},${r1(q[1])}`, tone: 'text', arrow: true});
  });
  b.steps.forEach((s, i) => {
    const [ax, ay] = at(angle(i)), nx = g4(ax), ny = g4(ay);
    const tone: TextTone = s.tone === 'danger' || s.tone === 'removed' ? 'danger' : s.tone === 'muted' ? 'muted' : 'accent';
    out.primitives.push({k: 'circle', cx: nx, cy: ny, r: nr, tone});
    anchor(s.id, {x: nx - nr, y: ny - nr, w: 2 * nr, h: 2 * nr});
    const label = t.wrap(s.label, nr * 1.5), sub = s.sub ? t.wrap(s.sub, nr * 1.5, 400) : undefined, top = ny - (label.h + (sub?.h ?? 0)) / 2;
    t.place(label, nx, top);
    if (sub) t.place(sub, nx, top + label.h, 'muted');
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
    out.primitives.push({k: 'circle', cx: px, cy: py, r, tone: s.tone ?? must(TONES[i]), opacity: .22, ...(DASH[i] ? {dash: DASH[i]} : {})});
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
  const ordered = b.order === 'outer-first' ? b.rings : [...b.rings].reverse(); // outermost first
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
    out.primitives.push({k: 'circle', cx, cy, r: rr, tone: ring.tone ?? must(TONES[i % 4]), opacity: .10 + (i % 2) * .05, ...(i % 2 ? {dash: '7,5'} : {})});
    anchor(ring.id, {x: cx - rr, y: cy - rr, w: 2 * rr, h: 2 * rr});
  });
  if (side) {
    // the key, top to bottom from the outermost ring; each entry has a leader to a dot in its ring (on the ray to the upper right)
    const slot = (out.h - 16) / n;
    ordered.forEach((ring, i) => {
      const k = must(keys[i]), top = out.y + 8 + i * slot + (slot - k.h) / 2, ly = top + Math.min(k.h, lh) / 2;
      const rm = (radius(i) + (i < n - 1 ? radius(i + 1) : 0)) / 2, a = -Math.PI / 6, dot: Pt = [g4(cx + rm * Math.cos(a)), g4(cy + rm * Math.sin(a))];
      out.primitives.push({k: 'path', d: `M${dot[0].toFixed(1)},${dot[1].toFixed(1)} L${(keyLeft - 8).toFixed(1)},${ly.toFixed(1)}`, tone: 'muted', thin: true});
      out.primitives.push({k: 'circle', cx: dot[0], cy: dot[1], r: 3.5, tone: 'text', opacity: 1});
      t.place(k, keyLeft, top, ring.tone ?? 'text', 'start');
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

// emblem: a word or two inside a circle, square, triangle, diamond or hexagon. Each shape has a rectangle in it where text fits (a fraction of
// the shape's width D): the label is wrapped to that rectangle's width and the shape grows, in 8px steps and all to the same size, until
// every label (and its sub line) is inside its own rectangle. The text is then centred in that rectangle, so it never touches the outline.
const EMBLEM_MAX = 320, EMBLEM_WORD_MAX = 240;
/** The text rectangle's width and height as fractions of D (its centre is chosen by the outline). The text boxes of real labels stay inside the outline by 2.3px at least (measured on the real fonts, 1620 cases); the rectangle's own corners touch the line at the smallest sizes (a hexagon at D=64), which no text box reaches (a line is 1.35em high, the box 1.2em). */
const EMBLEM_TEXT: Record<EmblemKind, {w: number; h: number}> = {circle: {w: .76, h: .56}, square: {w: .84, h: .84}, diamond: {w: .56, h: .34}, hexagon: {w: .68, h: .5}, triangle: {w: .54, h: .32}};

/**
 * The outline of a shape D wide with its top-left at (left, top). Everything is on the 4px grid and symmetric about the vertical centre line
 * (D is a multiple of 8, so the centre is on the grid too). `h` is the drawn height, `textCy` the text rectangle's centre below `top`,
 * `anchor` the rectangle connect() ties to: the bounding box, except for a triangle, where it joins the middles of the two slanted sides so
 * that :left / :right / :top / :bottom all land on the outline.
 */
function emblemOutline(kind: EmblemKind, left: number, top: number, d: number): {h: number; textCy: number; points?: Pt[]; anchor: Rect} {
  const cx = left + d / 2, bbox = (h: number): Rect => ({x: left, y: top, w: d, h});
  switch (kind) {
    case 'circle': return {h: d, textCy: d / 2, anchor: bbox(d)};
    case 'square': return {h: d, textCy: d / 2, points: [[left, top], [left + d, top], [left + d, top + d], [left, top + d]], anchor: bbox(d)};
    case 'diamond': return {h: d, textCy: d / 2, points: [[cx, top], [left + d, top + d / 2], [cx, top + d], [left, top + d / 2]], anchor: bbox(d)};
    case 'hexagon': {
      const q = g4(.25 * d), m = g4(.44 * d);
      return {h: 2 * m, textCy: m, points: [[left, top + m], [cx - q, top], [cx + q, top], [left + d, top + m], [cx + q, top + 2 * m], [cx - q, top + 2 * m]], anchor: bbox(2 * m)};
    }
    case 'triangle': {
      const h = g4(.9 * d);
      return {h, textCy: h - .2 * d, points: [[cx, top], [left + d, top + h], [left, top + h]], anchor: {x: left + d / 4, y: top, w: d / 2, h}};
    }
  }
}
const wordKind = (c: string | undefined): 'kana' | 'latin' | null => c === undefined ? null : /[ァ-ヺー-ヾ]/.test(c) || c === 'ー' ? 'kana' : /[A-Za-z0-9]/.test(c) ? 'latin' : null; // not ・ (U+30FB): it separates words
/** Whether wrapping `text` into `lines` cuts a katakana (or alphanumeric) word: the two letters either side of a break touch in the source (no space, newline or ・ between them). */
function splitsWord(text: string, lines: readonly string[]): boolean {
  let at = 0;
  for (const [i, line] of lines.entries()) {
    const skipped = /^\s*/.exec(text.slice(at))![0].length; // the source's own spaces / newlines before this line
    if (i > 0 && skipped === 0 && wordKind(lines[i - 1]!.at(-1)) !== null && wordKind(lines[i - 1]!.at(-1)) === wordKind(line[0])) return true;
    at += skipped;
    if (!text.startsWith(line, at)) return false; // the wrapper changed the text (it does not, today): say nothing rather than guess
    at += line.length;
  }
  return false;
}

function layoutEmblem(b: EmblemBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void {
  const kindOf = (i: EmblemItem): EmblemKind => i.kind ?? b.kind;
  const gap = g4(b.gap), widest = Math.min(EMBLEM_MAX, Math.floor(out.w / 8) * 8), least = Math.ceil((b.size ?? 96) / 8) * 8;
  if (least > widest) throw new Error(`emblem(): size ${b.size ?? 96} is wider than the band (${Math.round(out.w)}px) — lower \`size\` or widen the band`);
  const blocks = (d: number) => b.items.map(i => {
    const g = EMBLEM_TEXT[kindOf(i)], label = t.wrap(i.label, g.w * d), sub = i.sub ? t.wrap(i.sub, g.w * d, 400) : undefined;
    const fits = Math.max(label.w, sub?.w ?? 0) <= g.w * d + .5 && label.h + (sub?.h ?? 0) <= g.h * d;
    return {label, sub, fits, whole: !splitsWord(i.label, label.lines) && !(sub && i.sub && splitsWord(i.sub, sub.lines))};
  });
  // The least D where everything fits and every katakana / alphanumeric word stays whole (up to EMBLEM_WORD_MAX); a label that cannot be kept
  // whole even there (a very long word) is let off, so it does not spoil the others. Else the least D that fits, words cut.
  const wholeCap = Math.min(widest, EMBLEM_WORD_MAX), letOff = blocks(wholeCap).map(p => !p.whole);
  const solve = (whole: boolean, limit: number) => { for (let d = least; d <= limit; d += 8) { const plan = blocks(d); if (plan.every((p, n) => p.fits && (!whole || p.whole || letOff[n]))) return {d, plan}; } return undefined; };
  const found = solve(true, wholeCap) ?? solve(false, widest);
  if (!found) {
    const bad = must(b.items.find((_i, n) => !must(blocks(widest)[n]).fits)), kind = kindOf(bad);
    throw new Error(`emblem(): "${bad.label}"${bad.sub ? ` / "${bad.sub}"` : ''} does not fit in a ${kind} up to ${widest}px${widest < EMBLEM_MAX ? ' (the width of the band)' : ''} — shorten it, move words to \`sub\`${kind === 'square' ? '' : ", or use kind 'square'"}${widest < EMBLEM_MAX ? ', or widen the band' : ''}`);
  }
  const {d, plan} = found;
  const perRow = Math.max(1, Math.floor((out.w + gap) / (d + gap))), rows = Math.ceil(b.items.length / perRow);
  const rowH = Math.max(...b.items.map(i => emblemOutline(kindOf(i), 0, 0, d).h));
  out.h = rows * rowH + (rows - 1) * gap;
  b.items.forEach((item, n) => {
    const row = Math.floor(n / perRow), inRow = Math.min(perRow, b.items.length - row * perRow), col = n - row * perRow;
    const rowW = inRow * d + (inRow - 1) * gap, kind = kindOf(item);
    const left = g4(out.x + (out.w - rowW) / 2 + col * (d + gap)), h = emblemOutline(kind, 0, 0, d).h, top = g4(out.y + row * (rowH + gap) + (rowH - h) / 2);
    const o = emblemOutline(kind, left, top, d), tone = item.tone ?? 'plain';
    if (!o.points) out.primitives.push({k: 'circle', cx: left + d / 2, cy: top + d / 2, r: d / 2, tone: 'text', fill: tone});
    else out.primitives.push({k: 'polygon', points: o.points, tone});
    anchor(item.id, o.anchor);
    if (item.id) (out.bounds ??= []).push({id: item.id, x: left, y: top, w: d, h: o.h});
    const k = must(plan[n]), blockH = k.label.h + (k.sub?.h ?? 0), cx = left + d / 2, cy = top + o.textCy;
    t.place(k.label, cx, cy - blockH / 2);
    if (k.sub) t.place(k.sub, cx, cy - blockH / 2 + k.label.h, 'muted');
  });
}
