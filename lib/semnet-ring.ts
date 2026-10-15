// causalLoop({layout: 'ring'}): the nodes of one loop on an ellipse, the loop's links as elliptic arcs (ADR 0011 D).
import {Canvas} from './charts-base.ts';
import type {ChartGeom} from './charts-base.ts';
import {segHitsRect} from './bars.ts';
import type {Pt} from './graph-layout.ts';
import type {CausalLink, CausalLoop} from './semnet-analysis.ts';

type Rect = {x: number; y: number; w: number; h: number};
export const RING_MIN = 2, RING_MAX = 8;
const GAP = 36; // between neighbours: an arrow plus its sign
const ringFail = (msg: string): never => { throw new Error(`causalLoop({layout: 'ring'}): ${msg}`); };

/** What a ring needs: exactly one loop of 2-8 nodes (self links aside) that every node is on, and no link besides the loop's own. */
export function checkRing(nodes: readonly {id: string}[], links: readonly CausalLink[], loops: readonly CausalLoop[], direction: unknown): void {
  if (direction !== undefined) ringFail('direction has no meaning on a ring (drop direction, or use layout: \'layered\')');
  const real = loops.filter(l => l.nodes.length > 1), how = "use layout: 'layered'; a node outside the loop is an intervention";
  if (real.length !== 1) ringFail(`the graph must be one loop (found ${real.length} loops; ${how})`);
  const loop = real[0], on = new Set(loop.nodes), out = nodes.find(n => !on.has(n.id));
  if (out) ringFail(`the graph must be one loop ("${out.id}" is not on it; ${how})`);
  if (loop.nodes.length < RING_MIN || loop.nodes.length > RING_MAX) ringFail(`the loop has ${loop.nodes.length} nodes; a ring takes ${RING_MIN} to ${RING_MAX} (use layout: 'layered')`);
  const own = new Set(loop.linkIndexes), extra = links.findIndex((l, i) => !own.has(i) && l.from !== l.to);
  if (extra >= 0) ringFail(`the link ${links[extra].from} -> ${links[extra].to} is not part of the loop (a ring has no chords; use layout: 'layered')`);
}

const gapOf = (a: Rect, b: Rect): number => Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h));
const inside = (r: Rect, p: Pt): boolean => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;

export interface RingLayout {c: Canvas; positions: Map<string, Rect>; paths: Map<number, Pt[]>; centre: Pt}
/**
 * `loop.nodes` go clockwise from the top. rx follows from the width; ry is the first of 60, 68, ... where neighbours keep GAP between their boxes,
 * no two boxes touch and no arc runs through a box that is not its end. The canvas is as high as that needs, unless `height` says more (and fails if it says less).
 */
export function layoutRing(g: ChartGeom, ns: readonly {id: string; label: string; w: number; h: number}[], loop: CausalLoop, selfLinks: readonly {index: number; node: string}[], inset: {top?: number; bottom?: number} = {}): RingLayout {
  const selfLoops = selfLinks.length > 0;
  const n = loop.nodes.length, byId = new Map(ns.map(x => [x.id, x])), order = loop.nodes.map(id => byId.get(id)!);
  const maxW = Math.max(...order.map(x => x.w)), maxH = Math.max(...order.map(x => x.h)), sidePad = selfLoops ? 60 : 0;
  const rx = (g.w - maxW - 16 - sidePad) / 2, topPad = 16 + (selfLoops ? 22 : 0) + (inset.top ?? 0), botPad = 16 + (selfLoops ? 22 : 0) + (inset.bottom ?? 0);
  if (rx < 24) ringFail(`the figure is too narrow for ${n} nodes with these labels (${Math.round(g.w)}px wide; shorten the labels or use layout: 'layered')`);
  const theta = (i: number): number => -Math.PI / 2 + 2 * Math.PI * i / n, step = 2 * Math.PI / n;
  const at = (ry: number, t: number): Pt => ({x: rx * Math.cos(t), y: ry * Math.sin(t)});
  const boxes = (ry: number): Rect[] => order.map((x, i) => { const p = at(ry, theta(i)); return {x: p.x - x.w / 2, y: p.y - x.h / 2, w: x.w, h: x.h}; });
  /** The arc from node i to node i+1, from where it leaves the first box to where it reaches the second. */
  const arc = (ry: number, bs: Rect[], i: number): Pt[] => {
    const a = bs[i], b = bs[(i + 1) % n], t0 = theta(i), t1 = t0 + step;
    let lo = t0, hi = t1;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (inside(a, at(ry, m))) lo = m; else hi = m; }
    const from = hi; lo = t0; hi = t1;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (inside(b, at(ry, m))) hi = m; else lo = m; }
    const to = lo, pts: Pt[] = [at(ry, from)], cnt = Math.max(0, Math.ceil((to - from) / (Math.PI / 30)) - 1);
    for (let k = 1; k <= cnt; k++) pts.push(at(ry, from + (to - from) * k / (cnt + 1)));
    pts.push(at(ry, to));
    return pts;
  };
  let ry = 60, bs = boxes(ry), arcs: Pt[][] = [], ok = false;
  for (; ry <= 600; ry += 8) {
    bs = boxes(ry);
    let good = true;
    for (let i = 0; i < n && good; i++) for (let j = i + 1; j < n && good; j++) if (gapOf(bs[i], bs[j]) < ((j - i === 1 || (i === 0 && j === n - 1)) ? GAP : 8)) good = false;
    if (!good) continue;
    arcs = bs.map((_, i) => arc(ry, bs, i));
    for (let i = 0; i < n && good; i++) arcs[i].slice(1).forEach((p, k) => { const q = arcs[i][k]; bs.forEach((r, j) => { if (j !== i && j !== (i + 1) % n && segHitsRect({x1: q.x, y1: q.y, x2: p.x, y2: p.y}, r)) good = false; }); });
    if (good && arcs.every(a => a.length >= 2 && Math.hypot(a.at(-1)!.x - a[0].x, a.at(-1)!.y - a[0].y) >= 12)) { ok = true; break; }
  }
  if (!ok) ringFail(`the ${n} nodes do not fit on a ring this wide (${Math.round(g.w)}px; shorten the labels, drop a node, or use layout: 'layered')`);
  const need = Math.ceil(2 * ry + maxH + topPad + botPad);
  if (g.height !== undefined && g.height < need) ringFail(`height ${g.height} is too small for this ring; it needs at least ${need} (raise height, or drop it to let the figure grow)`);
  const H = Math.max(need, g.height ?? 0), cx = g.x + g.w / 2, cy = g.y + topPad + maxH / 2 + ry + (H - need) / 2;
  const move = (p: Pt): Pt => ({x: cx + p.x, y: cy + p.y}), c = new Canvas(g.x, g.y, g.w, H, g.size, g.widthOf);
  const positions = new Map<string, Rect>(), paths = new Map<number, Pt[]>();
  order.forEach((x, i) => { const r = bs[i]; positions.set(x.id, {x: cx + r.x, y: cy + r.y, w: r.w, h: r.h}); });
  for (const x of order) { const p = positions.get(x.id)!; c.solids.push({...p, id: x.id, label: `node "${x.label}"`}); }
  loop.linkIndexes.forEach((li, i) => paths.set(li, arcs[i].map(move)));
  // a link from a node to itself: a small loop on the side of the box that faces away from the middle (where no arc arrives)
  for (const {index, node} of selfLinks) {
    const p = positions.get(node)!, dx = (p.x + p.w / 2 - cx) / rx, dy = (p.y + p.h / 2 - cy) / ry, ex = 22, k = 10;
    if (Math.abs(dy) >= Math.abs(dx)) { const y = dy < 0 ? p.y : p.y + p.h, o = dy < 0 ? y - ex : y + ex, x = p.x + p.w / 2; paths.set(index, [{x: x - k, y}, {x: x - k, y: o}, {x: x + k, y: o}, {x: x + k, y}]); }
    else { const x = dx < 0 ? p.x : p.x + p.w, o = dx < 0 ? x - ex : x + ex, y = p.y + p.h / 2; paths.set(index, [{x, y: y - k}, {x: o, y: y - k}, {x: o, y: y + k}, {x, y: y + k}]); }
  }
  return {c, positions, paths, centre: {x: cx, y: cy}};
}
