// Where a return arrow of a cause tree crosses another line, and which crossings get a hop (an arc over the other line) (ADR 0028).
// Pure geometry of the laid-out figure: the layout calls it once and keeps the result in `LaidOutCause.crossings`; the renderer only draws it.
import {must} from './must.ts';
export interface HopPt {x: number; y: number}
export interface HopEdge {from: string; to: string; points: HopPt[]; line: 'solid' | 'dashed' | 'dotted'; back?: true; reversed?: true; kind?: 'blocks'}
export type HopFlow = 'up' | 'down' | 'right' | 'left';
export type HopSkip = 'dashed' | 'corner' | 'arrowhead' | 'bar' | 'neighbour' | 'and-arc' | 'band' | 'parallel';
export interface Crossing {over: number; under: number; x: number; y: number; /** the unit step the hop bulges toward (against the flow) */ side: HopPt; skipped?: HopSkip}

export const HOP_R = 6;
export const ARROW_L = 12;
const BAR_HALF = 10;
const widthOf = (e: HopEdge): number => e.kind === 'blocks' ? 2 : e.back ? 3 : 2;

const STEP: Record<HopFlow, HopPt> = {up: {x: 0, y: -1}, down: {x: 0, y: 1}, right: {x: 1, y: 0}, left: {x: -1, y: 0}};

/**
 * The crossings of every return's run across the layers (with `everyRun`, of every arrow's run across the layers) (a run at a right angle to the flow) with another line, in the order of the returns, each marked `skipped` when
 * it gets no hop. `rooms` are the boxes of the nodes and the band; `ands` the AND arcs (p0, c, p1).
 */
export function causeCrossings(edges: readonly HopEdge[], flow: HopFlow, band: {x: number; y: number; w: number; h: number}, boxes: readonly {x: number; y: number; w: number; h: number}[], ands: readonly {p0: HopPt; c: HopPt; p1: HopPt}[], everyRun = false): Crossing[] {
  const f = STEP[flow], against: HopPt = {x: 0 - f.x || 0, y: 0 - f.y || 0};
  const alongFlow = (a: HopPt, b: HopPt): boolean => f.x !== 0 ? a.y === b.y : a.x === b.x; // a run in the flow's direction (a lane run)
  const R = HOP_R, X = R + 2;
  const out: Crossing[] = [];
  edges.forEach((over, i) => {
    if ((!over.reversed && !everyRun) || over.kind === 'blocks') return;
    const found: (Crossing & {si: number})[] = [];
    over.points.slice(1).forEach((q, si) => {
      const p = over.points[si];
      if (!p || alongFlow(p, q) || (p.x !== q.x && p.y !== q.y)) return; // only the runs across the layers (axis-aligned, at a right angle to the flow)
      edges.forEach((e, j) => {
        if (j === i) return;
        e.points.slice(1).forEach((v, k) => {
          const u = e.points[k], sh = p.y === q.y;
          if (!u) return;
          if (sh ? u.x !== v.x : u.y !== v.y) return; // the other run must cross at a right angle
          const x = sh ? u.x : p.x, y = sh ? p.y : u.y;
          const inside = (a: number, b: number, t: number): boolean => t > Math.min(a, b) + 0.5 && t < Math.max(a, b) - 0.5;
          if (!(sh ? inside(p.x, q.x, x) && inside(u.y, v.y, y) : inside(p.y, q.y, y) && inside(u.x, v.x, x))) return;
          found.push({over: i, under: j, x, y, side: against, si});
        });
      });
    });
    for (const c of found) {
      const under = must(edges[c.under]), x = X, // c.under is an index of edges
         dist = (a: HopPt, b: HopPt): number => Math.hypot(a.x - b.x, a.y - b.y);
      const tipOf = (e: HopEdge): HopPt => must(e.points[e.points.length - 1]);
      let skip: HopSkip | undefined;
      const here = {x: c.x, y: c.y};
      // the runs the crossing lies on: its ends are corners (or the arrowhead's tip for the other line)
      const sRun = [must(over.points[c.si]), must(over.points[c.si + 1])]; // the run the crossing was found on
      const tRun = ((): [HopPt, HopPt, number] | undefined => { for (let k = 0; k + 1 < under.points.length; k++) { const a = under.points[k], b = under.points[k + 1]; if (!a || !b) continue; if (a.x === b.x ? a.x === c.x && c.y > Math.min(a.y, b.y) && c.y < Math.max(a.y, b.y) : a.y === b.y && a.y === c.y && c.x > Math.min(a.x, b.x) && c.x < Math.max(a.x, b.x)) return [a, b, k]; } return undefined; })();
      if (over.line !== 'solid') skip = 'dashed';
      else if (sRun.some(e => dist(e, here) < x)) skip = 'corner';
      else if (tRun) {
        const last = tRun[2] + 2 === under.points.length, tip = tipOf(under);
        if (under.kind === 'blocks' && last && dist(tip, here) < x + BAR_HALF) skip = 'bar';
        else if (last && dist(tip, here) < x + ARROW_L) skip = 'arrowhead';
        else if ([tRun[0], tRun[1]].some(e => dist(e, here) < x)) skip = 'corner';
      }
      if (!skip && found.some(o => o !== c && o.si === c.si && dist(o as HopPt, here) < 2 * x)) skip = 'neighbour';
      if (!skip && ands.some(a => {
        const xs = [a.p0.x, a.c.x, a.p1.x], ys = [a.p0.y, a.c.y, a.p1.y];
        return c.x > Math.min(...xs) - x && c.x < Math.max(...xs) + x && c.y > Math.min(...ys) - x && c.y < Math.max(...ys) + x;
      })) skip = 'and-arc';
      if (!skip) {
        const apex = {x: c.x + c.side.x * (R + 2), y: c.y + c.side.y * (R + 2)};
        const inRect = (r: {x: number; y: number; w: number; h: number}, p: HopPt): boolean => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
        if (!inRect(band, apex) || boxes.some(r => inRect(r, apex))) skip = 'band';
        else {
          // a parallel line close beside the bulge: another run of the same direction as the one the hop is on, on the side it bulges to
          const [r0, r1] = sRun, horizontal = r0 !== undefined && r1 !== undefined && r0.y === r1.y, room = R + widthOf(over) / 2 + 1 + 2;
          const near = edges.some((e, j) => j !== i && e.points.slice(1).some((v, k) => {
            const u = e.points[k];
            if (!u) return false;
            if (horizontal ? u.y !== v.y : u.x !== v.x) return false;
            const off = horizontal ? (u.y - c.y) * c.side.y : (u.x - c.x) * c.side.x;
            const span: [number, number, number] = horizontal ? [Math.min(u.x, v.x), Math.max(u.x, v.x), c.x] : [Math.min(u.y, v.y), Math.max(u.y, v.y), c.y];
            return off > 0 && off < room && span[2] > span[0] - (R + 2) && span[2] < span[1] + (R + 2);
          }));
          if (near) skip = 'parallel';
        }
      }
      out.push({over: c.over, under: c.under, x: c.x, y: c.y, side: c.side, ...(skip ? {skipped: skip} : {})});
    }
  });
  return out;
}
