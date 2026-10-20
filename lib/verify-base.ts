// Geometry helpers the per-band-type checks of verify-handlers.ts share.

import type {Rect} from './types/core.ts';

export const CONTRAST_THRESHOLD = 70; // same threshold lint-svg.ts's own contrast check uses

/**
 * Returns the overlap {dx,dy} if two rects share more than `tolerance`px of area in both axes, else null. Rects that merely
 * touch at a shared edge (adjacent row children, a box and the row's own bounding rect) are not overlaps.
 */
export function rectOverlap(a: Rect, b: Rect, tolerance = 0.5): {dx: number; dy: number} | null {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (ox <= tolerance || oy <= tolerance) return null;
  return {dx: ox, dy: oy};
}

export function labelOf(band: object): string {
  // bands name themselves differently (box title, banner headline, caption text, or just an id)
  const b = band as {title?: string; headline?: string; id?: string; text?: string};
  return b.title ?? b.headline ?? b.id ?? b.text ?? '(band)';
}

export const neverTogether = (a: {reveal?: number; until?: number}, b: {reveal?: number; until?: number}): boolean =>
  (a.until !== undefined && a.until <= (b.reveal ?? 0)) || (b.until !== undefined && b.until <= (a.reveal ?? 0));

type Pt = {x: number; y: number};
/** The 1px-padded box of one straight run of a route. */
export const segBox = (p: Pt, q: Pt): Rect => ({x: Math.min(p.x, q.x) - 1, y: Math.min(p.y, q.y) - 1, w: Math.abs(p.x - q.x) + 2, h: Math.abs(p.y - q.y) + 2});
/** Does any run of the route touch `r`? */
export const routeHits = (points: readonly Pt[], r: Rect): boolean => points.slice(1).some((q, m) => !!rectOverlap(r, segBox(must(points[m]), q)));
/** For each route and each node it does not start or end at: the first run that touches the node reports once (`say`). */
export function routesThroughNodes<E extends {from: string; to: string; points: readonly Pt[]}, N extends Rect & {id: string}>(
  edges: readonly E[], nodes: readonly N[], say: (e: E, n: N) => string,
): string[] {
  const problems: string[] = [];
  for (const e of edges) {
    for (const n of nodes) {
      if (n.id === e.from || n.id === e.to) continue;
      for (let i = 0; i + 1 < e.points.length; i++) {
        if (rectOverlap(segBox(must(e.points[i]), must(e.points[i + 1])), n)) {
          problems.push(say(e, n));
          break;
        }
      }
    }
  }
  return problems;
}

/** Every pair (earlier, later) of `items` that overlap: `report(a, b, overlap)`. */
export function eachOverlap<T extends Rect>(items: readonly T[], report: (a: T, b: T, o: {dx: number; dy: number}, i: number, j: number) => void): void {
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = must(items[i]), b = must(items[j]), o = rectOverlap(a, b);
    if (o) report(a, b, o, i, j);
  }
}

export const dxdy = (o: {dx: number; dy: number}): string => `${Math.round(o.dx)}x${Math.round(o.dy)}px`;
/** Past the left or right edge of the figure. */
export const outsideX = (r: Rect, fig: Rect): boolean => r.x < fig.x - 0.5 || r.x + r.w > fig.x + fig.w + 0.5;
/** Past any edge of the figure. */
export const outsideBox = (r: Rect, fig: Rect): boolean => outsideX(r, fig) || r.y < fig.y - 0.5 || r.y + r.h > fig.y + fig.h + 0.5;

/**
 * What the check finds wrong in a laid-out state diagram: a transition through a state it does not touch, a label chip outside the figure, on a state, on another arrow or on another chip.
 * The check (verify-handlers.ts) and the layout (states.ts: `density: 'compact'` falls back to the normal gaps when this finds more) use the same list.
 */
export function statesProblems(band: Rect & {edges: readonly {from: string; to: string; points: readonly Pt[]}[]; anchors: readonly (Rect & {id: string})[]; labels: readonly (Rect & {text: string; edge: number})[]}): string[] {
  const problems = routesThroughNodes(band.edges, band.anchors, (e, n) => `states: transition ${e.from} -> ${e.to} runs through state "${n.id}" (reorder the states, or change dir)`);
  for (const [i, l] of band.labels.entries()) {
    if (outsideX(l, band)) problems.push(`states: label "${l.text}" runs outside the figure (shorten it or widen the figure)`);
    for (const n of band.anchors) if (rectOverlap(l, n)) problems.push(`states: label "${l.text}" overlaps state "${n.id}" (shorten the label)`);
    band.edges.forEach((e, k) => { // the chip is white: on another arrow it would cut it
      if (k !== l.edge && routeHits(e.points, l)) problems.push(`states: label "${l.text}" sits on the arrow ${e.from} -> ${e.to} (it belongs to another arrow)`);
    });
    for (let j = i + 1; j < band.labels.length; j++) {
      const o = rectOverlap(l, band.labels[j]);
      if (o) problems.push(`states: label "${l.text}" overlaps label "${band.labels[j].text}" by ${dxdy(o)}`);
    }
  }
  return problems;
}
