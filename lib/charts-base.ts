// The shared ground of the consulting-style charts (waterfall, radar, heatmap, stacked bars / mekko, treemap, sankey, tornado, bubble, butterfly, combo, harvey):
// a small canvas that collects what a chart draws (rects, paths, texts), remembers where every label is, and finds a free spot for
// a label — so that each chart only says WHAT goes WHERE and verify.ts can check the result the same way for all of them.
import {segHitsRect} from './bars.ts';
import {splitAtoms, textWidth} from './atoms.ts';
import {wrapAtoms} from './wrap.ts';
import {niceNear} from './qc.ts';
import type {IconGlyph} from './icon-store.ts';
import type {ColorKey, Rect, RevealOpts, Roles, WidthOf, LabelRole} from './types.ts';

export type ChartKind = 'waterfall' | 'radar' | 'heatmap' | 'stacked' | 'treemap' | 'sankey' | 'tornado' | 'bubble' | 'butterfly' | 'combo' | 'harvey' | 'pert' | 'causal' | 'dependency';
export type ChartTone = 'accent' | 'danger' | 'muted' | 'text';
/** Options every chart has. */
export interface ChartOpts extends RevealOpts {
  /** A spotlight target and a connect() endpoint (the whole figure). The elements with an id of their own are anchors too. */
  id?: string;
  /** The text role of every label of the figure. Default 'note' (14px). */
  labelRole?: LabelRole;
  width?: number;
  height?: number;
  /** The text a screen reader / the <desc> gets instead of the one worked out from the data. */
  alt?: string;
}

/** The colour a label sits on, for the contrast check: a token colour at an opacity over the page. */
export interface ChartBg {fill: ColorKey; op?: number; /** The colour of the text (default: the page colour, as white on a dark bar). */ ink?: ColorKey}
export type ChartItem =
  | {k: 'rect'; x: number; y: number; w: number; h: number; fill: ColorKey | 'none'; op?: number; stroke?: ColorKey; sw?: number; dash?: string; of?: string | string[]}
  | {k: 'path'; d: string; fill: ColorKey | 'none'; op?: number; stroke?: ColorKey; sw?: number; dash?: string; of?: string | string[]; soft?: boolean}
  | {k: 'icon'; name: string; glyph: IconGlyph; x: number; y: number; size: number; fill: ColorKey; of?: string}
  | {k: 'text'; s: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; fill: ColorKey; size: number; bold?: boolean; of?: string};
export interface ChartBox extends Rect {label: string; on?: ChartBg; host?: number; of?: string; /** Drawn on a plate of the page colour: lines behind it are covered, not crossed. */ plate?: boolean}
export interface ChartSolid extends Rect {label: string; id?: string}
export interface ChartSeg {x1: number; y1: number; x2: number; y2: number}
export interface LaidOutChartPart {
  items: ChartItem[];
  boxes: ChartBox[];
  /** Rects that nothing else may overlap (bars, cells, nodes); a label may sit on one only when it is that label's own `host`. */
  solids: ChartSolid[];
  /** Lines a label must not be crossed by. */
  segs: ChartSeg[];
  anchors: {id: string; x: number; y: number; w: number; h: number}[];
  /** What the figure leaves out of its drawing (labels too small for their cell): listed in the description instead. */
  omitted: string[];
  h: number;
}

/** What every chart's layout is given: the band's room, its text size and the measurer. */
export interface ChartGeom {x: number; y: number; w: number; height?: number; size: number; widthOf: WidthOf}

export const overlaps = (a: Rect, b: Rect): boolean => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;

/** A number as it reads: exact (no float noise), thousands separated. */
export function numText(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  let s = String(parseFloat(n.toPrecision(12)));
  if (/e/i.test(s)) s = n.toFixed(6).replace(/\.?0+$/, '');
  const neg = s.startsWith('-'), [int, dec] = s.replace('-', '').split('.');
  return `${neg ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${dec ? `.${dec}` : ''}`;
}
/** A signed delta: +120 / -45 (0 is +0). */
export const signedText = (n: number): string => `${n < 0 ? '' : '+'}${numText(n)}`;
export const decimalsIn = (n: number): number => { const s = String(parseFloat(n.toPrecision(12))); const i = s.indexOf('.'); return /e/i.test(s) ? 6 : i < 0 ? 0 : s.length - i - 1; };

/** A value axis: the range widened to round ticks. */
export function niceScale(lo: number, hi: number, want = 5): {min: number; max: number; step: number; ticks: number[]} {
  if (!(hi > lo)) { hi = lo + 1; }
  const step = niceNear((hi - lo) / want);
  const min = Math.floor(lo / step + 1e-9) * step, max = Math.max(Math.ceil(hi / step - 1e-9) * step, min + step);
  const ticks: number[] = [];
  for (let i = 0; i <= Math.round((max - min) / step) && i < 100; i++) ticks.push(parseFloat((min + i * step).toPrecision(12)));
  return {min: parseFloat(min.toPrecision(12)), max: parseFloat(max.toPrecision(12)), step, ticks};
}

/** Ticks thin enough for their labels: every k-th tick (counting from the one at zero, or the first) so that neighbours are `gap` apart. */
export function thinTicks<T extends {v: number}>(ticks: T[], px: (v: number) => number, size: (t: T) => number, gap = 10): Set<T> {
  if (ticks.length < 2) return new Set(ticks);
  const pitch = Math.abs(px(ticks[1].v) - px(ticks[0].v)), need = Math.max(...ticks.map(size)) + gap;
  const k = Math.max(1, Math.ceil(need / Math.max(1, pitch))), zero = Math.max(0, ticks.findIndex(t => t.v === 0));
  return new Set(ticks.filter((_t, i) => ((i - zero) % k + k) % k === 0));
}

export interface Cand {x: number; y: number; anchor: 'start' | 'middle' | 'end'}

export class Canvas {
  readonly items: ChartItem[] = [];
  readonly boxes: ChartBox[] = [];
  readonly solids: ChartSolid[] = [];
  readonly segs: ChartSeg[] = [];
  readonly anchors: {id: string; x: number; y: number; w: number; h: number}[] = [];
  readonly omitted: string[] = [];
  /** Small marks (a line chart's markers) a label placed by place() keeps off; verify does not check them (two may share a spot). */
  readonly marks: Rect[] = [];
  readonly x: number; readonly y: number; readonly w: number; h: number; readonly size: number; readonly widthOf: WidthOf;
  constructor(x: number, y: number, w: number, h: number, size: number, widthOf: WidthOf) { this.x = x; this.y = y; this.w = w; this.h = h; this.size = size; this.widthOf = widthOf; }

  tw(s: string, bold = false): number { return textWidth(this.widthOf, s, this.size, bold ? 700 : 400); }
  /** The box a label of this text occupies (the same box verify and the lint see). */
  boxOf(s: string, x: number, base: number, anchor: 'start' | 'middle' | 'end', bold = false): Rect {
    const w = this.tw(s, bold);
    return {x: anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x, y: base - this.size, w, h: this.size + 4};
  }
  /** The baseline that centres a line of text on `cy`. */
  mid(cy: number): number { return Math.round(cy + this.size * 0.36); }

  rect(x: number, y: number, w: number, h: number, o: {fill: ColorKey | 'none'; op?: number; stroke?: ColorKey; sw?: number; dash?: string; id?: string; of?: string; solid?: string}): number {
    this.items.push({k: 'rect', x, y, w, h, fill: o.fill, ...(o.op === undefined ? {} : {op: o.op}), ...(o.stroke ? {stroke: o.stroke} : {}), ...(o.sw ? {sw: o.sw} : {}), ...(o.dash ? {dash: o.dash} : {}), ...(o.of ? {of: o.of} : {})});
    if (o.id) this.anchors.push({id: o.id, x, y, w, h});
    if (o.solid !== undefined) { this.solids.push({x, y, w, h, label: o.solid, ...(o.id ? {id: o.id} : {})}); return this.solids.length - 1; }
    return -1;
  }
  path(d: string, o: {fill: ColorKey | 'none'; op?: number; stroke?: ColorKey; sw?: number; dash?: string; of?: string | string[]; soft?: boolean}): void {
    this.items.push({k: 'path', d, fill: o.fill, ...(o.op === undefined ? {} : {op: o.op}), ...(o.stroke ? {stroke: o.stroke} : {}), ...(o.sw ? {sw: o.sw} : {}), ...(o.dash ? {dash: o.dash} : {}), ...(o.of ? {of: o.of} : {}), ...(o.soft ? {soft: true} : {})});
  }
  line(x1: number, y1: number, x2: number, y2: number, o: {stroke: ColorKey; sw?: number; dash?: string; of?: string; avoid?: boolean; soft?: boolean}): void {
    const r = (n: number) => Math.round(n * 10) / 10;
    this.path(`M${r(x1)},${r(y1)} L${r(x2)},${r(y2)}`, {fill: 'none', stroke: o.stroke, sw: o.sw ?? 2, dash: o.dash, of: o.of, soft: o.soft});
    if (o.avoid) this.segs.push({x1, y1, x2, y2});
  }
  /** An installed icon beside a label (decoration: the label says what it is). */
  icon(glyph: IconGlyph, name: string, x: number, y: number, size: number, fill: ColorKey, of?: string): void {
    this.items.push({k: 'icon', name, glyph, x, y, size, fill, ...(of ? {of} : {})});
  }
  /** Draws a label and registers its box. Coordinates are whole pixels, so the box is exactly what is drawn. */
  text(s: string, x: number, base: number, anchor: 'start' | 'middle' | 'end', fill: ColorKey, o: {bold?: boolean; of?: string; on?: ChartBg; host?: number; plate?: boolean} = {}): ChartBox {
    x = Math.round(x); base = Math.round(base);
    if (o.plate) { const p = this.boxOf(s, x, base, anchor, o.bold); this.items.push({k: 'rect', x: p.x - 2, y: p.y, w: p.w + 4, h: p.h, fill: 'bg'}); }
    this.items.push({k: 'text', s, x, y: base, anchor, fill, size: this.size, ...(o.bold ? {bold: true} : {}), ...(o.of ? {of: o.of} : {})});
    const b: ChartBox = {label: s, ...this.boxOf(s, x, base, anchor, o.bold), ...(o.on ? {on: o.on} : {}), ...(o.plate ? {plate: true} : {}), ...(o.host !== undefined && o.host >= 0 ? {host: o.host} : {}), ...(o.of ? {of: o.of} : {})};
    this.boxes.push(b);
    return b;
  }
  /** Is there room for this box: inside the figure, off every other label, off every solid but its host, clear of the lines to avoid? */
  free(b: Rect, host = -1, margin = 0, plated = false): boolean {
    if (b.x < this.x - 0.5 + margin || b.x + b.w > this.x + this.w + 0.5 - margin || b.y < this.y - 0.5 + margin || b.y + b.h > this.y + this.h + 0.5 - margin) return false;
    if (this.boxes.some(o => overlaps(b, o))) return false;
    if (this.solids.some((s, i) => i !== host && overlaps(b, s))) return false;
    if (this.marks.some(m => overlaps(b, m))) return false;
    return plated || !this.segs.some(sg => segHitsRect(sg, {x: b.x - 1, y: b.y, w: b.w + 2, h: b.h}));
  }
  /** Draws the label at the first candidate that is free; undefined (nothing drawn) when none is. */
  place(s: string, cands: Cand[], fill: ColorKey, o: {bold?: boolean; of?: string; on?: ChartBg; host?: number; plate?: boolean} = {}): ChartBox | undefined {
    for (const c of cands) if (this.free(this.boxOf(s, Math.round(c.x), Math.round(c.y), c.anchor, o.bold), o.host ?? -1, 0, !!o.plate)) return this.text(s, c.x, c.y, c.anchor, fill, o);
    return undefined;
  }
  /** Wraps text into lines no wider than `maxW` (an atom wider than that stays on a line of its own). */
  wrap(s: string, maxW: number, bold = false): string[] {
    return wrapAtoms(splitAtoms(s), {maxWidth: Math.max(20, maxW), atomWidth: a => textWidth(this.widthOf, a, this.size, bold ? 700 : 400)});
  }
  /** Several lines of one label, centred on x, the first line's baseline at `base`. */
  lines(ls: string[], x: number, base: number, anchor: 'start' | 'middle' | 'end', fill: ColorKey, o: {bold?: boolean; of?: string; plate?: boolean} = {}): void {
    ls.forEach((l, i) => this.text(l, x, base + i * Math.round(this.size * 1.25), anchor, fill, o));
  }
  lineH(): number { return Math.round(this.size * 1.25); }
  done(): LaidOutChartPart {
    return {items: this.items, boxes: this.boxes, solids: this.solids, segs: this.segs, anchors: this.anchors, omitted: this.omitted, h: this.h};
  }
}

/** The label size of a chart: its role's size. */
export const sizeOf = (labelRole: LabelRole | undefined, roles: Roles): number => roles[labelRole ?? 'note'];

/** An error with the chart's name in front. */
export const fail = (who: string, msg: string): never => { throw new Error(`${who}(): ${msg}`); };
export function finiteNum(who: string, what: string, v: unknown, o: {min?: number} = {}): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) >= 1e15) fail(who, `${what} must be a finite number (got ${String(v)})`);
  if (o.min !== undefined && (v as number) < o.min) fail(who, `${what} must be >= ${o.min} (got ${v})`);
  return v as number;
}
export function checkText(who: string, what: string, v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) fail(who, `${what} must be a non-empty string`);
  return v as string;
}
export function checkIds(who: string, ids: (string | undefined)[], bandId: string | undefined): void {
  const given = ids.filter((i): i is string => !!i);
  if (new Set(given).size !== given.length) fail(who, 'each id must be unique');
  if (bandId !== undefined && given.includes(bandId)) fail(who, `the band's id "${bandId}" is also an element's id — each id must be unique`);
}
/** Opacity of the accent for the n-th of `count` shades, light to dark (the ladder pyramid() uses, spread over `count` steps). */
export function shadeOps(count: number): number[] {
  const ladder: Record<number, number[]> = {1: [0.5], 2: [0.25, 0.7], 3: [0.15, 0.5, 0.85], 4: [0.12, 0.35, 0.6, 0.85], 5: [0.1, 0.3, 0.5, 0.7, 0.9], 6: [0.1, 0.25, 0.4, 0.55, 0.7, 0.9]};
  return ladder[count] ?? ladder[6];
}
/** The text colour that reads on the accent at this opacity. */
export const inkOnShade = (op: number): ColorKey => op >= 0.6 ? 'bg' : 'text';
