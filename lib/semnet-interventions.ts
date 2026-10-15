// causalLoop({interventions}): the boxes outside the loop and the arrows from them (ADR 0011 C). Planning only decides where things go; semnet-causal.ts draws them (stage 1) and places their signs (stage 2).
import type {Canvas} from './charts-base.ts';
import {segHitsRect} from './bars.ts';
import type {Pt} from './graph-layout.ts';

type Rect = {x: number; y: number; w: number; h: number};
/** Which edge of the figure a box sits on: LR is `top`, TB is `left`, a ring uses `top` and `bottom` (the outside of the ring). */
export type Side = 'top' | 'bottom' | 'left';
export const BOX_H = 48, ARROW = 40, GAP = 16, MARGIN = 8;
export interface IvItem {id: string; label: string; to: readonly string[]; w: number}
export interface PlacedIv {item: IvItem; box: Rect; arrows: {to: string; path: Pt[]}[]}
/** How much of the figure's `side` the band takes, `attempt` times 8px thicker each retry (the layout is given this much less room). */
export const bandInset = (side: Side, items: readonly IvItem[], attempt: number): number => side === 'left' ? MARGIN + Math.max(0, ...items.map(i => i.w)) + ARROW + 8 * attempt : BOX_H + ARROW + 8 * attempt;
/** On a ring: a node in the upper half of the ellipse (the top included) is reached from above, the others from below. */
export function ringSide(loopNodes: readonly string[], to: readonly string[]): Side {
  const upper = to.filter(id => { const f = loopNodes.indexOf(id) / loopNodes.length; return f <= .25 + 1e-9 || f >= .75 - 1e-9; }).length;
  return upper * 2 >= to.length ? 'top' : 'bottom';
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/**
 * Boxes in order of where their targets are, pushed apart by GAP (forwards, then back from the end), each with one arrow per target:
 * straight when the box and the target share a stretch, otherwise down, across and down. An arrow may cross a loop link but not a node box.
 */
export function planInterventions(c: Canvas, items: readonly IvItem[], positions: ReadonlyMap<string, Rect>, sideOf: (it: IvItem) => Side): {placed: PlacedIv[]} | {problem: string} {
  const placed: PlacedIv[] = [], nodes = [...positions.entries()], boxes: {id: string; r: Rect}[] = [];
  for (const side of ['top', 'bottom', 'left'] as const) {
    const group = items.filter(i => sideOf(i) === side);
    if (!group.length) continue;
    const horizontal = side !== 'left', len = (i: IvItem): number => horizontal ? i.w : BOX_H;
    const centreU = (r: Rect): number => horizontal ? r.x + r.w / 2 : r.y + r.h / 2;
    const want = new Map(group.map(i => [i.id, i.to.reduce((a, t) => a + centreU(positions.get(t)!), 0) / i.to.length]));
    const order = [...group].sort((a, b) => want.get(a.id)! - want.get(b.id)! || (a.id < b.id ? -1 : 1));
    const lo = (horizontal ? c.x : c.y) + MARGIN, start = new Map<string, number>();
    let prev = lo - GAP;
    for (const i of order) { const s = Math.max(want.get(i.id)! - len(i) / 2, prev + GAP); start.set(i.id, s); prev = s + len(i); }
    if (horizontal) {
      const hi = c.x + c.w - MARGIN; let next = hi + GAP;
      for (const i of [...order].reverse()) { const s = Math.min(start.get(i.id)!, next - GAP - len(i)); start.set(i.id, s); next = s; }
      if (next < lo - 1e-6) return {problem: `the ${group.length} intervention boxes on the ${side} (${group.map(i => `"${i.label}"`).join(', ')}) are wider than the figure (${Math.round(c.w)}px)`};
    } else if (prev + MARGIN > c.y + c.h) c.h = prev + MARGIN - c.y; // a column of boxes may be taller than the loop; the figure grows
    for (const i of order) {
      const s = start.get(i.id)!, r: Rect = side === 'left' ? {x: c.x + MARGIN, y: s, w: i.w, h: BOX_H} : {x: s, y: side === 'top' ? c.y + MARGIN : c.y + c.h - MARGIN - BOX_H, w: i.w, h: BOX_H};
      boxes.push({id: i.id, r});
    }
    // arrows, once the boxes of this side are known
    for (const [k, i] of order.entries()) {
      const r = boxes.find(b => b.id === i.id)!.r, bt = side === 'left' ? r.w : r.h, e = MARGIN + bt, bu0 = horizontal ? r.x : r.y, bu1 = bu0 + len(i);
      const uv = (q: Rect) => horizontal ? {u0: q.x, u1: q.x + q.w, v0: side === 'top' ? q.y - c.y : c.y + c.h - (q.y + q.h)} : {u0: q.y, u1: q.y + q.h, v0: q.x - c.x};
      const xy = (u: number, v: number): Pt => side === 'left' ? {x: c.x + v, y: u} : side === 'top' ? {x: u, y: c.y + v} : {x: u, y: c.y + c.h - v};
      const arrows: PlacedIv['arrows'] = [];
      for (const to of i.to) {
        const t = uv(positions.get(to)!), n = t.v0, m = e + 14 + 6 * (k % 4), tc = (t.u0 + t.u1) / 2;
        if (n - e < 12 || m > n - 8) return {problem: `the arrow of intervention "${i.id}" to "${to}" has no room between its box and the node`};
        const lo2 = Math.max(bu0 + 10, t.u0 + 6), hi2 = Math.min(bu1 - 10, t.u1 - 6), cands: [number, number][][] = [];
        if (lo2 <= hi2) for (const u of new Set([clamp(tc, lo2, hi2), (lo2 + hi2) / 2, lo2, hi2])) cands.push([[u, e], [u, n]]);
        const s0 = clamp(tc, bu0 + 10, bu1 - 10);
        for (const en of new Set([clamp(tc, t.u0 + 6, t.u1 - 6), t.u0 + 8, t.u1 - 8])) cands.push([[s0, e], [s0, m], [en, m], [en, n]]);
        let hitName = '';
        const ok = cands.map(cd => cd.map(([u, v]) => xy(u, v))).find(path => {
          for (let q = 1; q < path.length; q++) {
            const sg = {x1: path[q - 1].x, y1: path[q - 1].y, x2: path[q].x, y2: path[q].y};
            const hit = nodes.find(([id, nr]) => id !== to && segHitsRect(sg, nr))?.[0] ?? boxes.find(b => b.id !== i.id && segHitsRect(sg, b.r))?.id;
            if (hit) { hitName ||= hit; return false; }
          }
          return true;
        });
        if (!ok) return {problem: `the arrow of intervention "${i.id}" to "${to}" would run through "${hitName || 'a box'}"`};
        arrows.push({to, path: ok});
      }
      placed.push({item: i, box: r, arrows});
    }
  }
  const off = placed.find(p => p.box.x < c.x - 0.5 || p.box.x + p.box.w > c.x + c.w + 0.5 || p.box.y < c.y - 0.5 || p.box.y + p.box.h > c.y + c.h + 0.5);
  if (off) return {problem: `the intervention "${off.item.id}" does not fit in the figure`};
  return {placed};
}
