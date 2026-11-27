// ADR 0085 D2 (U2): in a deck, a concentric / venn / cycle may draw its labels larger than the usual 14px so that they come out about as large
// as the rest of the slide. The deck asks with `textSize` (the largest size it wants); the part draws every candidate from there down to the usual
// size and keeps the largest one whose labels still sit inside the circles they belong to (with a margin, the .pptx is set in another font)
// and that does not make the figure taller (a taller figure would be shrunk by the deck, which is no gain).
import {DEF, defOf} from './band-def.ts';
import type {SelectedPart} from './spec-selective.ts';
import type {LaidOutFlowShape} from './flow-types.ts';
import type {Roles} from './types/core.ts';

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

/** The roles with the label sizes of a candidate: the usual ones for the usual size. */
const rolesAt = (roles: Roles, size: number): Roles => size === roles.note ? roles : {...roles, note: size, label: size};

type Data = {type: string; textSize?: number};
/** The two hooks of a flow band's definition that the larger labels change (their environments are the definition's own). */
interface GrowDef {
  measure?(data: Data, env: {roles: Roles}): void;
  layout(data: Data, env: {roles: Roles}): {h: number; laid: LaidOutFlowShape};
}

/**
 * The band definition drawing every candidate size: it measures them all, and lays the shape out at the largest asked-for size at which `fits`
 * holds and the figure is no taller (else at the usual size). The band's own definition does the work with other roles.
 */
const grownDef = (def: GrowDef, fits: FitFn<never>): GrowDef => ({
  ...def,
  measure: (data, env) => { for (const size of [env.roles.note, ...growSizes(data.textSize, env.roles.note)]) def.measure?.(data, {...env, roles: rolesAt(env.roles, size)}); },
  layout: (data, env) => {
    const base = def.layout(data, env);
    for (const size of growSizes(data.textSize, env.roles.note)) {
      const grown = def.layout(data, {...env, roles: rolesAt(env.roles, size)});
      if (grown.h <= base.h + 0.5 && fits(data as never, grown.laid)) return grown;
    }
    return base;
  },
});

const FITS: Record<string, FitFn<never>> = {concentric: concentricFits as FitFn<never>, venn: vennFits as FitFn<never>, cycle: cycleFits as FitFn<never>};

/** A band of a part that can use larger labels, asked for labels up to `size` px (the deck's second drawing, ADR 0085 D2); other bands as they are. */
export function growBand<B extends {type: string}>(band: B, size: number, builtIn?: (band: B) => object | undefined): B {
  const fits = FITS[band.type], def = fits ? defOf(band) ?? builtIn?.(band) : undefined;
  if (!fits || !def) return band;
  return Object.defineProperty(Object.assign(band, {textSize: size}), DEF, {value: grownDef(def as unknown as GrowDef, fits), enumerable: true, writable: true, configurable: true});
}

/** The bands of a diagram asked for larger labels (`builtIn`: the definition of a band built from plain data, which carries none); nothing without a size. */
export function askTextSize<B extends {type: string}>(bands: readonly B[], size: number | undefined, builtIn?: (band: B) => object | undefined): void {
  if (size !== undefined) for (const b of bands) growBand(b, size, builtIn);
}

/** The selected parts, those that can use larger labels building bands that ask for them (the deck's second drawing). */
export const growParts = (parts: readonly SelectedPart[], size: number): SelectedPart[] =>
  parts.map(p => FITS[p.type] ? {...p, build: (part, at) => { const built = p.build(part, at); return Array.isArray(built) ? built.map(b => growBand(b, size)) : growBand(built as {type: string}, size); }} as SelectedPart : p);
