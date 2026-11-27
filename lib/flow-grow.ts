// ADR 0085 D2 (U2): in a deck, a concentric / venn / cycle may draw its labels larger than the usual 14px so that they come out about as large
// as the rest of the slide. The deck asks with `textSize` (the largest size it wants); the part draws every candidate from there down to the usual
// size and keeps the largest one whose labels still sit inside the circles they belong to (with a margin, the .pptx is set in another font)
// and that does not make the figure taller (a taller figure would be shrunk by the deck, which is no gain).
import type {PublicEnv} from './band-def.ts';
import {placeFlow} from './flow-definition.ts';
import type {FlowLayout} from './flow-layout-core.ts';
import type {FlowShapeBand, LaidOutFlowShape} from './flow-types.ts';
import type {FontFamily, Roles} from './types/core.ts';

type Box = {x: number; y: number; w: number; h: number};
type Circle = {cx: number; cy: number; r: number};
export type FitFn<B> = (b: B, out: LaidOutFlowShape) => boolean;

/** The text must fill at most this share of the room it is checked against (the .pptx is drawn in Office's font, not the measured one). */
const MARGIN = 0.92;
/** The largest size a part is asked for. */
const MAX_SIZE = 22;

/** The sizes tried, largest first, all above `base`. */
export const growSizes = (want: number | undefined, base: number): number[] => {
  const sizes: number[] = [];
  for (let s = Math.min(Math.floor(want ?? 0), MAX_SIZE); s > base; s -= 2) sizes.push(s);
  return sizes;
};

/** The measurement requests of every candidate size (only a deck figure has any, so a document figure measures what it always did). */
export function growTexts<B extends FlowShapeBand & {textSize?: number}>(texts: (b: B, roles: Roles) => [string, number, number, FontFamily][]): (b: B, roles: Roles) => [string, number, number, FontFamily][] {
  return (b, roles) => [roles.note, ...growSizes(b.textSize, roles.note)].flatMap(size => texts(b, {...roles, note: size, label: size === roles.note ? roles.label : size}));
}

/** The shape drawn at the usual size, or at the largest asked-for size at which `fits` holds and the figure is no taller. */
export function placeGrown<B extends FlowShapeBand & {textSize?: number}>(data: B, env: PublicEnv, draw: FlowLayout<B>, fits: FitFn<B>) {
  const base = placeFlow(data, env, draw);
  for (const size of growSizes(data.textSize, env.roles.note)) {
    const grown = placeFlow(data, {...env, roles: {...env.roles, note: size, label: size}}, draw);
    if (grown.h <= base.h + 0.5 && fits(data, grown.laid)) return grown;
  }
  return base;
}

const inflate = (b: Box): Box => ({x: b.x + b.w / 2 - b.w / 2 / MARGIN, y: b.y + b.h / 2 - b.h / 2 / MARGIN, w: b.w / MARGIN, h: b.h / MARGIN});
const corners = (b: Box): [number, number][] => [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]];
const dist = ([x, y]: [number, number], c: Circle): number => Math.hypot(x - c.cx, y - c.cy);
const circles = (out: LaidOutFlowShape): Circle[] => out.primitives.flatMap(p => p.k === 'circle' ? [p] : []);
/** The circle whose centre is nearest the middle of `box`. */
const nearestOf = (cs: readonly Circle[], box: Box): number => {
  const d = (c: Circle) => Math.hypot(box.x + box.w / 2 - c.cx, box.y + box.h / 2 - c.cy);
  return cs.reduce((best, c, i) => (d(c) < d(cs[best] ?? c) ? i : best), 0);
};
const boxesOf = (out: LaidOutFlowShape, label: string | undefined): Box[] => out.labelBoxes.filter(l => l.label === label).map(inflate);

/** concentric (labels inside, no sectors): each ring's label sits in its own band, the centre's inside the innermost ring. */
export const concentricFits: FitFn<import('./flow-types.ts').ConcentricBand> = (b, out) => {
  if (b.sectors || b.labels === 'side') return false;
  const ring = circles(out), ordered = b.order === 'outer-first' ? b.rings : b.rings.toReversed();
  const label = (i: number) => { const r = ordered[i]; return r?.description ? `${r.label} — ${r.description}` : r?.label; };
  const inBand = (i: number) => (boxesOf(out, label(i)).every(box => corners(box).every(p => { const o = ring[i], inner = ring[i + 1]; return !!o && dist(p, o) <= o.r && (!inner || dist(p, inner) >= inner.r); })));
  const last = ring[ring.length - 1];
  return ring.length === ordered.length && ordered.every((_r, i) => inBand(i)) && (!b.centre || !last || boxesOf(out, b.centre).every(box => corners(box).every(p => dist(p, last) <= last.r)));
};

/** venn: a set's words in the part only it covers, an overlap's label in the part exactly its sets share, the centre's in all of them. */
export const vennFits: FitFn<import('./flow-types.ts').VennBand> = (b, out) => {
  const cs = circles(out).slice(0, b.sets.length);
  if (cs.length !== b.sets.length) return false;
  const where = (box: Box, inside: number[]): boolean => corners(box).every(p => cs.every((c, i) => inside.includes(i) ? dist(p, c) <= c.r : dist(p, c) >= c.r));
  const all = cs.map((_c, i) => i);
  const named = new Set<string | undefined>([b.centre, ...b.overlaps.map(o => o.label)]);
  const overlapsOk = b.overlaps.every(o => boxesOf(out, o.label).every(box => where(box, o.sets.map(n => b.sets.findIndex(s => s.name === n)))));
  const centreOk = !b.centre || boxesOf(out, b.centre).every(box => where(box, all));
  const own = out.labelBoxes.filter(l => !named.has(l.label) && l.label !== (typeof b.universe === 'string' ? b.universe : undefined)).map(inflate);
  return overlapsOk && centreOk && own.every(box => where(box, [nearestOf(cs, box)]));
};

/** cycle (no links): each step's words inside its circle. */
export const cycleFits: FitFn<import('./flow-types.ts').CycleBand> = (b, out) => {
  if (b.links) return false;
  const nodes = circles(out);
  return out.labelBoxes.filter(l => l.label !== b.centre && l.label !== b.frame).map(inflate).every(box => {
    const c = nodes[nearestOf(nodes, box)];
    return !c || corners(box).every(p => dist(p, c) <= c.r);
  }) && out.labelBoxes.filter(l => l.label === b.centre).map(inflate).every(box => corners(box).every(p => nodes.every(n => dist(p, n) >= n.r)));
};

const GROWN_BANDS: ReadonlySet<string> = new Set(['concentric', 'venn', 'cycle']);
/** Asks the bands of a figure that can use it for labels up to `size` px (the deck's second drawing, ADR 0085 D2); nothing without a size. */
export function askTextSize(bands: readonly {type: string}[], size?: number): void {
  if (size !== undefined) for (const b of bands) if (GROWN_BANDS.has(b.type)) Object.assign(b, {textSize: size});
}
