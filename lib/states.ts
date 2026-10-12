// stateDiagram(): states and transitions that place themselves (graph-layout.ts layoutLayered). A state is a box like a tree
// node; a transition is an orthogonal arrow routed through the layers it skips; a label sits on the arrow in a white chip.
import {textWidth} from './atoms.ts';
import {layoutLayered} from './graph-layout.ts';
import type {Pt} from './graph-layout.ts';
import {measureNode, nodeRuns} from './tree.ts';
import type {NodeLines} from './tree.ts';
import type {FontFamily, LaidOutStates, Roles, StatesBand, WidthOf} from './types.ts';

const STUB = 18, ARROW = 14, MAX_W = 200, GAP = 28, DOT = 8, LOOP = 26, LOOP_W = 12, CHIP_PAD = 6, INIT = '\u0000init';

export function statesTexts(band: StatesBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const s of band.states) out.push([s.label, roles.body, 700, 'sans'], [s.sub ?? '', roles.note, 400, 'sans']);
  for (const t of band.transitions) if (t.label) out.push([t.label, roles.note, 400, 'sans']);
  return out;
}

const swap = (p: Pt): Pt => ({x: p.y, y: p.x});
const same = (a: Pt, b: Pt): boolean => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

/** Drops repeated points and the middle point of three on a line, so a polyline has only its corners. */
function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) if (!out.length || !same(out[out.length - 1], p)) out.push(p);
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const a = out[i - 1], b = out[i + 1];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/**
 * Horizontal-vertical-horizontal elbows through the points (the layer axis is x here). A direct arrow turns `STUB + lane` after
 * its tail, which leaves a long straight run into the head for its label; `lane` keeps arrows through one gap apart.
 */
function elbows(pts: Pt[], lane: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (p.y !== q.y) {
      const mx = pts.length === 2 ? p.x + Math.sign(q.x - p.x || 1) * Math.min(STUB + lane, Math.abs(q.x - p.x) / 2) : (p.x + q.x) / 2;
      out.push({x: mx, y: p.y}, {x: mx, y: q.y});
    }
    out.push(q);
  }
  return simplify(out);
}

/** The point a fraction t of the way along a polyline's length. */
function pointAt(pts: Pt[], t: number): Pt {
  const len = pts.slice(1).map((p, i) => Math.abs(p.x - pts[i].x) + Math.abs(p.y - pts[i].y));
  let half = len.reduce((a, b) => a + b, 0) * t;
  for (let i = 0; i < len.length; i++) {
    if (half <= len[i] || i === len.length - 1) { const t = len[i] ? half / len[i] : 0; return {x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t}; }
    half -= len[i];
  }
  return pts[0];
}

export function layoutStatesBand(band: StatesBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutStates {
  const dir = band.dir ?? 'right', S = roles.note, maxW = band.maxNodeW ?? MAX_W;
  const ids = new Set<string>();
  for (const s of band.states) {
    if (typeof s.id !== 'string' || !s.id || s.id === INIT) throw new Error('stateDiagram(): every state needs an id');
    if (typeof s.label !== 'string' || !s.label.trim()) throw new Error(`stateDiagram(): state "${s.id}" needs a label`);
    if (ids.has(s.id)) throw new Error(`stateDiagram(): duplicate state id "${s.id}"`);
    ids.add(s.id);
  }
  for (const t of band.transitions) for (const e of [t.from, t.to]) if (!ids.has(e)) throw new Error(`stateDiagram(): transition ${t.from} -> ${t.to} names unknown state "${e}"`);
  if (band.initial !== undefined && !ids.has(band.initial)) throw new Error(`stateDiagram(): initial names unknown state "${band.initial}"`);

  const lines = new Map<string, NodeLines>(band.states.map(s => [s.id, measureNode(s.label, s.sub, maxW, widthOf, roles)]));
  const labelW = (t: string): number => Math.ceil(textWidth(widthOf, t, S, 400)) + 2 * CHIP_PAD;
  const widest = Math.max(0, ...band.transitions.map(t => t.label ? labelW(t.label) : 0));
  const nodes = band.states.map(s => ({id: s.id, size: {w: lines.get(s.id)!.w, h: lines.get(s.id)!.h}}));
  const edges = band.transitions.map(t => ({from: t.from, to: t.to}));
  const loops = band.transitions.filter(t => t.from === t.to);
  if (band.initial) { nodes.unshift({id: INIT, size: {w: 2 * DOT, h: 2 * DOT}}); edges.push({from: INIT, to: band.initial}); }
  const swapSize = (s: {w: number; h: number}): {w: number; h: number} => ({w: s.h, h: s.w});
  // layered layout runs on a 'right' axis; a 'down' diagram is the same layout transposed
  const lay = layoutLayered(dir === 'down' ? nodes.map(n => ({id: n.id, size: swapSize(n.size)})) : nodes, edges, {
    // a loop needs room beside its state (down) or between rows (right), so states do not crowd it
    dir: 'right', gap: loops.length ? GAP + LOOP + (dir === 'down' ? Math.max(...loops.map(t => t.label ? labelW(t.label) : 0)) : 0) : GAP,
    levelGap: dir === 'down' ? 72 : widest ? widest + STUB + ARROW + 8 : 64, ...(band.initial ? {start: [INIT]} : {}),
  });
  const at = (id: string) => { const p = lay.nodes.get(id)!; return dir === 'down' ? {x: p.y, y: p.x, w: p.h, h: p.w} : p; };

  // a loop sits above its state when the flow runs right (room is made at the top), and to its right when the flow runs down
  const loopLabelH = loops.some(t => t.label) ? S + 10 : 0;
  const top = loops.length && dir === 'right' ? LOOP + loopLabelH + 6 : 0;
  const total = {w: dir === 'down' ? lay.h : lay.w, h: dir === 'down' ? lay.w : lay.h};
  // dir down: the loop and its label stick out to the right of the rightmost state
  const reserve = dir === 'down' && loops.length ? LOOP + 4 + Math.max(...loops.map(t => t.label ? labelW(t.label) : 0)) : 0;
  if (total.w + reserve > w + 0.5) throw new Error(`stateDiagram(): the figure is ${Math.ceil(total.w + reserve)}px wide but it has ${Math.round(w)}px (use dir: 'right', a smaller maxNodeW, or fewer states on one level)`);
  const dx = x + (w - total.w - reserve) / 2, dy = y + top;
  const out: LaidOutStates = {
    type: 'states', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: total.h + top,
    nodes: [], edges: [], texts: [], labels: [], anchors: [], labelBoxes: [],
  };
  const rects = new Map<string, {x: number; y: number; w: number; h: number}>();
  for (const s of band.states) {
    const p = at(s.id), r = {x: p.x + dx, y: p.y + dy, w: p.w, h: p.h};
    rects.set(s.id, r);
    out.nodes.push({...r, tone: s.tone ?? 'plain', ...(s.final ? {final: true} : {})});
    out.anchors.push({id: s.id, ...r});
    out.texts.push(...nodeRuns(r, lines.get(s.id)!, roles));
    out.labelBoxes.push({label: s.label, ...r});
  }
  if (band.initial) { const p = at(INIT); out.initial = {x: p.x + dx + DOT, y: p.y + dy + DOT, r: DOT}; }

  // transitions: routed in the layout's own ('right') axes, then transposed for dir down and moved into the figure
  // ports: the edges that meet one side of a state fan out along it (ordered by where the other end is, so they do not cross)
  // lanes: direct arrows through one gap between two layers take separate vertical runs
  const portOf = new Map<string, number>(), laneOf = new Map<number, number>();
  const ends: {key: string; edge: number; end: 0 | 1; other: number}[] = [];
  const corridors = new Map<string, number[]>();
  lay.edges.forEach((e, i) => {
    if (e.self) return;
    const A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!, ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
    const first = e.points[1] ?? cb, last = e.points[e.points.length - 2] ?? ca;
    ends.push({key: `${e.from}:${first.x >= ca.x ? 'r' : 'l'}`, edge: i, end: 0, other: first.y}, {key: `${e.to}:${last.x <= cb.x ? 'l' : 'r'}`, edge: i, end: 1, other: last.y});
    if (e.points.length === 2) { const k = `${Math.round(Math.min(ca.x, cb.x))}:${Math.round(Math.max(ca.x, cb.x))}`; corridors.set(k, [...(corridors.get(k) ?? []), i]); }
  });
  const byKey = new Map<string, typeof ends>();
  for (const en of ends) byKey.set(en.key, [...(byKey.get(en.key) ?? []), en]);
  for (const list of byKey.values()) {
    list.sort((p, q) => p.other - q.other || p.edge - q.edge);
    list.forEach((en, k) => {
      const e = lay.edges[en.edge], id = en.end === 0 ? e.from : e.to, h = lay.nodes.get(id)!.h;
      const step = list.length > 1 ? Math.min(14, (h - 12) / (list.length - 1)) : 0;
      portOf.set(`${en.edge}:${en.end}`, (k - (list.length - 1) / 2) * step);
    });
  }
  for (const list of corridors.values()) list.forEach((i, k) => laneOf.set(i, k * 14));
  const used = new Set<number>();
  const pickTransition = (from: string, to: string) => {
    const k = band.transitions.findIndex((tr, i) => !used.has(i) && tr.from === from && tr.to === to);
    if (k >= 0) used.add(k);
    return k >= 0 ? band.transitions[k] : undefined;
  };
  const place = (p: Pt): Pt => { const q = dir === 'down' ? swap(p) : p; return {x: q.x + dx, y: q.y + dy}; };
  const hit = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  // a label sits on its arrow, in a chip: the middle of the arrow if free, else the nearest spot along it that clears the states and the other chips
  const addLabel = (own: number, text: string, at: (t: number) => Pt, on: Pt[] = []): void => {
    const lw = labelW(text), lh = S + 8;
    const boxAt = (c: Pt) => ({x: c.x - lw / 2, y: c.y - lh / 2, w: lw, h: lh});
    const tip = on.length ? {x: on[on.length - 1].x - ARROW, y: on[on.length - 1].y - ARROW, w: 2 * ARROW, h: 2 * ARROW} : null; // the arrowhead
    // a chip is white: on another arrow it would cut that arrow, so it keeps off every arrow but its own
    const onOther = (b: ReturnType<typeof boxAt>): boolean => out.edges.some((e, k) => k !== own && e.points.slice(1).some((q, m) => {
      const p = e.points[m];
      return hit(b, {x: Math.min(p.x, q.x) - 1, y: Math.min(p.y, q.y) - 1, w: Math.abs(p.x - q.x) + 2, h: Math.abs(p.y - q.y) + 2});
    }));
    const free = (b: ReturnType<typeof boxAt>): boolean => !out.labels.some(o => hit(b, o)) && !out.nodes.some(n => hit(b, n)) && !(tip && hit(b, tip)) && !onOther(b);
    // first choice: beside the arrow's straight runs, last run first (above a horizontal one, to the right of a vertical one)
    const runs: Pt[] = [];
    for (let k = on.length - 2; k >= 0; k--) {
      const p = on[k], q = on[k + 1], last = k === on.length - 2, trim = last ? ARROW : 0;
      if (dir === 'right' && p.y === q.y) {
        const len = Math.abs(q.x - p.x) - trim;
        if (len >= lw) runs.push({x: p.x + Math.sign(q.x - p.x) * (len / 2), y: p.y - lh / 2 - 3});
      } else if (dir === 'down' && p.x === q.x) {
        const len = Math.abs(q.y - p.y) - trim;
        if (len >= lh + 4) runs.push({x: p.x + 6 + lw / 2, y: p.y + Math.sign(q.y - p.y) * (len / 2)}, {x: p.x - 6 - lw / 2, y: p.y + Math.sign(q.y - p.y) * (len / 2)});
      }
    }
    // candidates, nearest to the arrow first: its straight runs, then points along it, then spots beside those (right / left / above / below)
    const offs: [number, number][] = [[0, 0], [lw / 2 + 8, 0], [-(lw / 2 + 8), 0], [0, lh + 2], [0, -(lh + 2)], [lw / 2 + 8, lh + 2], [-(lw / 2 + 8), lh + 2], [lw / 2 + 8, -(lh + 2)], [-(lw / 2 + 8), -(lh + 2)], [0, 2 * (lh + 2)], [0, -2 * (lh + 2)], [lw + 12, 0], [-(lw + 12), 0]];
    const cands: {p: Pt; cost: number}[] = runs.map(p => ({p, cost: -1}));
    for (let f = 0.05; f < 0.96; f += 0.05) for (const [ox, oy] of offs) { const q = at(f); cands.push({p: {x: q.x + ox, y: q.y + oy}, cost: Math.hypot(ox, oy) + Math.abs(f - 0.5) * 30}); }
    cands.sort((u, v) => u.cost - v.cost);
    const c = (cands.find(k => free(boxAt(k.p))) ?? cands[0]).p;
    const b = boxAt(c);
    out.labels.push({text, ...b, tx: c.x, ty: b.y + S + 2, size: S, edge: own});
    out.labelBoxes.push({label: text, ...b});
  };
  // every arrow is routed first, then the labels are placed (a chip must know where the other arrows run)
  const pending: {edge: number; text: string; at: (t: number) => Pt; on?: Pt[]}[] = [];
  for (const [i, e] of lay.edges.entries()) {
    const t = e.from === INIT ? undefined : pickTransition(e.from, e.to);
    if (e.self) {
      const a = rects.get(e.from)!, cx = a.x + a.w / 2, cy = a.y + a.h / 2;
      if (dir === 'down') {
        const pts = [{x: a.x + a.w, y: cy - LOOP_W}, {x: a.x + a.w + LOOP, y: cy - LOOP_W}, {x: a.x + a.w + LOOP, y: cy + LOOP_W}, {x: a.x + a.w, y: cy + LOOP_W}];
        out.edges.push({from: e.from, to: e.to, points: pts, line: t?.line ?? 'solid'});
        if (t?.label) { const lw = labelW(t.label); pending.push({edge: out.edges.length - 1, text: t.label, at: () => ({x: a.x + a.w + LOOP + 4 + lw / 2, y: cy})}); }
        continue;
      }
      const pts = [{x: cx + LOOP_W, y: a.y}, {x: cx + LOOP_W, y: a.y - LOOP}, {x: cx - LOOP_W, y: a.y - LOOP}, {x: cx - LOOP_W, y: a.y}];
      out.edges.push({from: e.from, to: e.to, points: pts, line: t?.line ?? 'solid'});
      if (t?.label) pending.push({edge: out.edges.length - 1, text: t.label, at: () => ({x: cx, y: a.y - LOOP - (S + 8) / 2 - 2})});
      continue;
    }
    const A = lay.nodes.get(e.from)!, B = lay.nodes.get(e.to)!, ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: B.x + B.w / 2, y: B.y + B.h / 2};
    const first = e.points[1] ?? cb, last = e.points[e.points.length - 2] ?? ca;
    const start = {x: first.x >= ca.x ? A.x + A.w : A.x, y: ca.y + (portOf.get(`${i}:0`) ?? 0)};
    const end = {x: last.x <= cb.x ? B.x : B.x + B.w, y: cb.y + (portOf.get(`${i}:1`) ?? 0)};
    const pts = elbows([start, ...e.points.slice(1, -1), end], laneOf.get(i) ?? 0).map(place);
    out.edges.push({from: e.from, to: e.to, points: pts, line: t?.line ?? 'solid'});
    if (t?.label) pending.push({edge: out.edges.length - 1, text: t.label, at: f => pointAt(pts, f), on: pts});
  }
  for (const p of pending) addLabel(p.edge, p.text, p.at, p.on);
  return out;
}
