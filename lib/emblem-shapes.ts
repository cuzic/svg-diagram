// The outlines of emblem() shapes (ADR 0043, 0044): for each shape, a width D (a multiple of 8) and a top-left give the drawn outline, the rectangle
// where text fits, and the rectangle connect() ties to. Pure geometry; flow-shapes.ts lays the labels out in it.
//  - every vertex / edge sits on the 4px grid, and the outline is symmetric about the vertical centre line (a parallelogram about its centre point),
//  - `h` is the drawn height, `textCy` the text rectangle's centre below `top`. A pill, rounded square, parallelogram, document and cylinder are
//    as wide as D but as tall as their text needs (emblemHeight), so one line of `sub` does not make every shape of a band bigger,
//  - `anchor` is the rectangle connect() ties to, chosen so that :top / :bottom / :left / :right land ON the outline (the bounding box for a
//    circle, square, diamond, hexagon, pentagon, pill, rounded and cylinder; the middles of the slanted sides for a triangle, trapezoid and parallelogram;
//    a document ends at the wave's middle).
import type {Rect} from './types/core.ts';
import {must} from './must.ts';

export type EmblemShape =
  | 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon'
  | 'trapezoid' | 'inverted-trapezoid' | 'parallelogram' | 'pentagon'
  | 'pill' | 'rounded' | 'document' | 'cylinder';
export const EMBLEM_SHAPES: readonly EmblemShape[] = [
  'circle', 'square', 'triangle', 'diamond', 'hexagon', 'trapezoid', 'inverted-trapezoid', 'parallelogram', 'pentagon', 'pill', 'rounded', 'document', 'cylinder',
];

type Pt = [number, number];
const g4 = (v: number): number => Math.round(v / 4) * 4;

/** The text rectangle's width and height as fractions of D (its centre is `textCy`, below). Chosen so its corners stay inside the outline (see emblemClearance). */
export const EMBLEM_TEXT: Record<EmblemShape, {w: number; h: number}> = {
  circle: {w: .76, h: .56}, square: {w: .84, h: .84}, diamond: {w: .56, h: .34}, hexagon: {w: .68, h: .5}, triangle: {w: .54, h: .32},
  trapezoid: {w: .6, h: .3}, 'inverted-trapezoid': {w: .6, h: .3}, parallelogram: {w: .56, h: .28}, pentagon: {w: .76, h: .32},
  pill: {w: .72, h: .3}, rounded: {w: .84, h: .46}, document: {w: .84, h: .42}, cylinder: {w: .84, h: .4},
};

/** The shapes whose height follows their text (their width is D, as for the others). */
export const EMBLEM_FLEX: ReadonlySet<EmblemShape> = new Set<EmblemShape>(['pill', 'rounded', 'parallelogram', 'document', 'cylinder']);
const up4 = (v: number): number => Math.ceil(v / 4) * 4;
/** The height of a shape D wide that holds `textH` of text: the default height, or taller for a shape in EMBLEM_FLEX whose text needs more. */
export function emblemHeight(shape: EmblemShape, d: number, textH = 0): number {
  switch (shape) {
    case 'pill': return Math.max(d / 2, up4(textH / .6)); // the text rectangle is .6 of the height
    case 'rounded': return Math.max(g4(.7 * d), up4(textH + .24 * d));
    case 'parallelogram': return Math.max(g4(.6 * d), up4(textH + .32 * d));
    case 'document': return Math.max(g4(.8 * d), up4(textH + .38 * d));
    case 'cylinder': return Math.max(g4(.85 * d), up4(textH + .45 * d));
    default: return emblemOutline(shape, 0, 0, d).h;
  }
}
/** The tallest a shape D wide may grow for its text (a pill stops at a circle; the others at 1.6 D), before D itself has to grow. */
export const emblemMaxHeight = (shape: EmblemShape, d: number): number => shape === 'pill' ? d : EMBLEM_FLEX.has(shape) ? 1.6 * d : emblemOutline(shape, 0, 0, d).h;

export interface EmblemOutline {
  h: number; textCy: number; anchor: Rect;
  /** A polygon outline, or ... */ points?: Pt[];
  /** ... an SVG path (pill / rounded / document / cylinder), or neither: a circle. */ path?: string;
  /** The bounding box of what is drawn (a path's extent, which the layout's measure of a figure needs). */ box: Rect;
}

/** `height` is the drawn height of a shape in EMBLEM_FLEX (emblemHeight); the others ignore it. */
export function emblemOutline(shape: EmblemShape, left: number, top: number, d: number, height?: number): EmblemOutline {
  const cx = left + d / 2, right = left + d, bbox = (h: number): Rect => ({x: left, y: top, w: d, h});
  const poly = (h: number, textCy: number, points: Pt[], anchor: Rect = bbox(h)): EmblemOutline => ({h, textCy, points, anchor, box: bbox(h)});
  switch (shape) {
    case 'circle': return {h: d, textCy: d / 2, anchor: bbox(d), box: bbox(d)};
    case 'square': return poly(d, d / 2, [[left, top], [right, top], [right, top + d], [left, top + d]]);
    case 'diamond': return poly(d, d / 2, [[cx, top], [right, top + d / 2], [cx, top + d], [left, top + d / 2]]);
    case 'hexagon': {
      const q = g4(.25 * d), m = g4(.44 * d);
      return poly(2 * m, m, [[left, top + m], [cx - q, top], [cx + q, top], [right, top + m], [cx + q, top + 2 * m], [cx - q, top + 2 * m]]);
    }
    case 'triangle': {
      const h = g4(.9 * d);
      return poly(h, h - .2 * d, [[cx, top], [right, top + h], [left, top + h]], {x: left + d / 4, y: top, w: d / 2, h});
    }
    case 'trapezoid': { // narrow at the top
      const h = g4(.7 * d), t = g4(.2 * d);
      return poly(h, .6 * h, [[left + t, top], [right - t, top], [right, top + h], [left, top + h]], {x: left + t / 2, y: top, w: d - t, h});
    }
    case 'inverted-trapezoid': { // wide at the top (a manual operation)
      const h = g4(.7 * d), t = g4(.2 * d);
      return poly(h, .4 * h, [[left, top], [right, top], [right - t, top + h], [left + t, top + h]], {x: left + t / 2, y: top, w: d - t, h});
    }
    case 'parallelogram': { // data (input / output)
      const h = height ?? g4(.6 * d), s = g4(.2 * d);
      return poly(h, h / 2, [[left + s, top], [right, top], [right - s, top + h], [left, top + h]], {x: left + s / 2, y: top, w: d - s, h});
    }
    case 'pentagon': { // a rectangle with a pointed bottom (an off-page connector)
      const h = g4(.8 * d), b = g4(.5 * d);
      return poly(h, .26 * d, [[left, top], [right, top], [right, top + b], [cx, top + h], [left, top + b]]);
    }
    case 'pill': { // a terminator
      const h = height ?? d / 2, r = h / 2;
      return {h, textCy: h / 2, anchor: bbox(h), box: bbox(h),
        path: `M${left + r},${top} H${right - r} A${r},${r} 0 0 1 ${right - r},${top + h} H${left + r} A${r},${r} 0 0 1 ${left + r},${top} Z`};
    }
    case 'rounded': { // a process
      const h = height ?? g4(.7 * d), r = Math.max(8, g4(.1 * d));
      return {h, textCy: h / 2, anchor: bbox(h), box: bbox(h),
        path: `M${left + r},${top} H${right - r} A${r},${r} 0 0 1 ${right},${top + r} V${top + h - r} A${r},${r} 0 0 1 ${right - r},${top + h} H${left + r} A${r},${r} 0 0 1 ${left},${top + h - r} V${top + r} A${r},${r} 0 0 1 ${left + r},${top} Z`};
    }
    case 'cylinder': { // storage / a database
      const h = height ?? g4(.85 * d), ry = Math.max(4, g4(.1 * d)), rx = d / 2;
      return {h, textCy: (h + ry) / 2, anchor: bbox(h), box: bbox(h),
        path: `M${left},${top + ry} A${rx},${ry} 0 0 1 ${right},${top + ry} V${top + h - ry} A${rx},${ry} 0 0 1 ${left},${top + h - ry} Z M${right},${top + ry} A${rx},${ry} 0 0 1 ${left},${top + ry}`}; // the rim runs the same way round as the body, so the two do not cancel (a hole) under the nonzero fill rule
    }
    case 'document': { // a sheet with a wavy bottom
      const h = height ?? g4(.8 * d), a = Math.max(4, g4(.07 * d)), b = top + h;
      // the wave: crest at b - 2a, trough at b (a quadratic reaches only halfway to its control point, so the controls are b - 3a and, reflected, b + a)
      return {h, textCy: (h - a) / 2, anchor: bbox(h - a), box: bbox(h),
        path: `M${left},${top} H${right} V${b - a} Q${right - d / 4},${b - 3 * a} ${cx},${b - a} T${left},${b - a} Z`};
    }
  }
}

// ---- clearance: how far a point is inside the outline (for the tests, and for tuning EMBLEM_TEXT) -----------------------------------------------------

const ARC = 48; // segments per arc when an outline is flattened
const arc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number): Pt[] =>
  Array.from({length: ARC + 1}, (_, i) => { const t = from + (to - from) * i / ARC; return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)] as Pt; });
const quad = (p0: Pt, c: Pt, p1: Pt): Pt[] => Array.from({length: ARC + 1}, (_, i) => { const t = i / ARC, u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]] as Pt; });

/** The outline flattened to a closed polygon, plus lines inside it that text must also keep off (a cylinder's rim). */
function flatOutline(shape: EmblemShape, left: number, top: number, d: number, height?: number): {outline: Pt[]; lines: Pt[][]} {
  const o = emblemOutline(shape, left, top, d, height), cx = left + d / 2, right = left + d, h = o.h;
  if (o.points) return {outline: o.points, lines: []};
  switch (shape) {
    case 'circle': return {outline: arc(cx, top + d / 2, d / 2, d / 2, 0, 2 * Math.PI), lines: []};
    case 'pill': { const r = h / 2; return {outline: [...arc(right - r, top + r, r, r, -Math.PI / 2, Math.PI / 2), ...arc(left + r, top + r, r, r, Math.PI / 2, 3 * Math.PI / 2)], lines: []}; }
    case 'rounded': { const r = Math.max(8, g4(.1 * d)); return {outline: [...arc(right - r, top + r, r, r, -Math.PI / 2, 0), ...arc(right - r, top + h - r, r, r, 0, Math.PI / 2), ...arc(left + r, top + h - r, r, r, Math.PI / 2, Math.PI), ...arc(left + r, top + r, r, r, Math.PI, 3 * Math.PI / 2)], lines: []}; }
    case 'cylinder': {
      const ry = Math.max(4, g4(.1 * d)), rx = d / 2;
      return {outline: [...arc(cx, top + ry, rx, ry, Math.PI, 2 * Math.PI), ...arc(cx, top + h - ry, rx, ry, 0, Math.PI)], lines: [arc(cx, top + ry, rx, ry, 0, Math.PI)]};
    }
    case 'document': {
      const a = Math.max(4, g4(.07 * d)), b = top + h;
      return {outline: [[left, top], [right, top], [right, b - a], ...quad([right, b - a], [right - d / 4, b - 3 * a], [cx, b - a]), ...quad([cx, b - a], [left + d / 4, b + a], [left, b - a])], lines: []};
    }
    default: return {outline: [], lines: []};
  }
}

const inPolygon = (poly: Pt[], [x, y]: Pt): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = must(poly[i]), [xj, yj] = must(poly[j]);
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const distToSegment = ([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number => {
  const dx = bx - ax, dy = by - ay, t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** How far `q` is inside the outline of a shape of drawn height `height` (EMBLEM_FLEX shapes; negative: outside), measured to the nearest edge; a line inside it (a cylinder's rim) counts as an edge too. */
export function emblemClearance(shape: EmblemShape, left: number, top: number, d: number, q: Pt, height?: number): number {
  const {outline, lines} = flatOutline(shape, left, top, d, height);
  let near = Infinity;
  for (const loop of [outline, ...lines]) for (let i = 0; i < loop.length - (loop === outline ? 0 : 1); i++) near = Math.min(near, distToSegment(q, must(loop[i]), must(loop[(i + 1) % loop.length])));
  return inPolygon(outline, q) ? near : -near;
}
