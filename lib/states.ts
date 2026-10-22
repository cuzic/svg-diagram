// stateDiagram(): states and transitions that place themselves (graph-layout.ts layoutLayered). A state is a box like a tree
// node; a transition is an orthogonal arrow routed through the layers it skips; a label sits on the arrow in a white chip.
import {textWidth} from './atoms.ts';
import {fitLayout} from './fit-width.ts';
import {statesProblems} from './verify-base.ts';
import {gapFor, layeredAttempt, stubOf} from './layered-route.ts';
import type {Pt} from './graph-layout.ts';
import {measureNode, nodeRuns} from './tree.ts';
import {diamondLines, ontoDiamond, pillLines} from './flow-nodes.ts';
import {statesWords} from './states-words.ts';
import type {NodeLines} from './tree.ts';
import type {FontFamily, Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {LaidOutStates, StatesBand} from './types/diagrams.ts';

import {must} from './must.ts';
export const STATE_ICON = 24;
const ICON_H = STATE_ICON + 4; // an icon above the label: its size and a gap
const ARROW = 14, GAP = 28, DOT = 8, LOOP = 26, LOOP_W = 12, CHIP_PAD = 6, INIT = '\u0000init';

export function statesTexts(band: StatesBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const s of band.states) out.push([s.label, roles.body, 700, 'sans'], [s.sub ?? '', roles.note, 400, 'sans']);
  for (const t of band.transitions) if (t.label) out.push([t.label, roles.note, 400, 'sans']);
  return out;
}

const swap = (p: Pt): Pt => ({x: p.y, y: p.x});

/** The point a fraction t of the way along a polyline's length. */
function pointAt(pts: Pt[], t: number): Pt {
  const len = pts.slice(1).map((p, i) => Math.abs(p.x - must(pts[i]).x) + Math.abs(p.y - must(pts[i]).y));
  let half = len.reduce((a, b) => a + b, 0) * t;
  for (let i = 0; i < len.length; i++) {
    if (half <= must(len[i]) || i === len.length - 1) { const t = len[i] ? half / must(len[i]) : 0; return {x: must(pts[i]).x + (must(pts[i + 1]).x - must(pts[i]).x) * t, y: must(pts[i]).y + (must(pts[i + 1]).y - must(pts[i]).y) * t}; }
    half -= must(len[i]);
  }
  return must(pts[0]);
}

export function layoutStatesBand(band: StatesBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number): LaidOutStates {
  const out = layoutStatesBandAt(band, x, y, w, widthOf, roles, env, heightBudget);
  if (env.space === undefined || env.space === 1) return out;
  // `density: 'compact'` must not make the check find more wrong in a state diagram (a label on another label or arrow, an arrow through a state): then it is drawn at the normal gaps
  const bad = statesProblems(out).length;
  if (bad === 0) return out;
  try { const normal = layoutStatesBandAt(band, x, y, w, widthOf, roles, {...env, space: 1}, heightBudget); if (statesProblems(normal).length < bad) { normal.densityRestored = true; return normal; } return out; } catch { return out; }
}

function layoutStatesBandAt(band: StatesBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number): LaidOutStates {
  const S = roles.note, words = statesWords(band.flavor);
  const ids = new Set<string>();
  for (const s of band.states) {
    if (typeof s.id !== 'string' || !s.id || s.id === INIT) throw new Error(`${words.who}: every ${words.node} needs an id`);
    if (typeof s.label !== 'string' || !s.label.trim()) throw new Error(`${words.who}: ${words.node} "${s.id}" needs a label`);
    if (ids.has(s.id)) throw new Error(`${words.who}: duplicate ${words.node} id "${s.id}"`);
    ids.add(s.id);
  }
  for (const t of band.transitions) for (const e of [t.from, t.to]) if (!ids.has(e)) throw new Error(`${words.who}: ${words.edge} ${t.from} -> ${t.to} names unknown ${words.node} "${e}"`);
  if (band.initial !== undefined && !ids.has(band.initial)) throw new Error(`${words.who}: initial names unknown ${words.node} "${band.initial}"`);


  const circles = new Set(band.states.filter(s => s.shape === 'circle').map(s => s.id)); // round nodes: arrows keep to the middle of their side (ADR 0016 D3)
  const labelW = (t: string): number => Math.ceil(textWidth(widthOf, t, S, 400)) + 2 * CHIP_PAD;
  const widest = Math.max(0, ...band.transitions.map(t => t.label ? labelW(t.label) : 0));
  const edges = band.transitions.map(t => ({from: t.from, to: t.to}));
  const loops = band.transitions.filter(t => t.from === t.to);
  // the most arrows that meet one state (each needs its own lane in the gap beside it)
  const degree = Math.max(1, ...band.states.map(s => Math.max(band.transitions.filter(t => t.from === s.id && t.from !== t.to).length, band.transitions.filter(t => t.to === s.id && t.from !== t.to).length)));
  if (band.initial) edges.push({from: INIT, to: band.initial});
  const swapSize = (s: {w: number; h: number}): {w: number; h: number} => ({w: s.h, h: s.w});
  const loopLabelH = loops.some(t => t.label) ? S + 10 : 0;
  // One whole attempt: the text wrapped at maxW, laid out running `dir`. Everything that depends on either is in here.
  const build = (dir: 'right' | 'down', maxW: number, floor: boolean) => {
    // a round node is as wide as its text needs and as tall as it is wide
    const lines = new Map<string, NodeLines>(band.states.map(s => {
      const iconH = s.icon ? ICON_H : 0;
      if (s.shape === 'diamond') return [s.id, diamondLines(s.label, s.sub, maxW, iconH, widthOf, roles, env.wrap, floor)];
      const l = measureNode(s.label, s.sub, maxW, widthOf, roles, env.wrap, floor, {keepWords: s.shape !== 'circle'});
      if (s.shape === 'pill') return [s.id, pillLines(l, iconH)];
      if (s.shape !== 'circle') return [s.id, {...l, h: l.h + iconH}];
      const text = Math.max(...l.label.map(t => textWidth(widthOf, t, roles.body, 700)), ...l.sub.map(t => textWidth(widthOf, t, roles.note, 400))), inner = l.h - 16 + iconH;
      const d = Math.max(44, Math.ceil((Math.hypot(text, inner) + 10) / 8) * 8); // a multiple of 8: the radius sits on the 4px grid
      return [s.id, {...l, w: d, h: d}];
    }));
    const nodes = band.states.map(s => { const m = must(lines.get(s.id)); return {id: s.id, size: {w: m.w, h: m.h}}; });
    if (band.initial) nodes.unshift({id: INIT, size: {w: 2 * DOT, h: 2 * DOT}});
    // layered layout runs on a 'right' axis; a 'down' diagram is the same layout transposed
    const reserve = dir === 'down' && loops.length ? LOOP + 4 + Math.max(...loops.map(t => t.label ? labelW(t.label) : 0)) : 0;
    const top = loops.length && dir === 'right' ? LOOP + loopLabelH + 6 : 0;
    const placeIn = (total: {w: number; h: number}) => (p: Pt): Pt => { const q = dir === 'down' ? swap(p) : p; return {x: q.x + x + (w - total.w - reserve) / 2, y: q.y + y + top}; };
    const run = layeredAttempt(dir === 'down' ? nodes.map(n => ({id: n.id, size: swapSize(n.size)})) : nodes, edges, {
      // a loop needs room beside its state (down) or between rows (right), so states do not crowd it
      dir: 'right', gap: loops.length ? GAP + LOOP + (dir === 'down' ? Math.max(...loops.map(t => t.label ? labelW(t.label) : 0)) : 0) : Math.round(GAP * (env.space ?? 1)),
      levelGap: Math.max(dir === 'down' ? Math.round(72 * (env.space ?? 1)) : widest ? widest + stubOf(env.space) + ARROW + 8 : Math.round(64 * (env.space ?? 1)), gapFor(degree, 0, env.space)), ...(band.initial ? {start: [INIT]} : {}),
    }, {transpose: dir === 'down', maxAcross: w + 0.5 - reserve, place: placeIn, tighten: true, round: id => circles.has(id), ...(env.space === undefined || env.space === 1 ? {} : {space: env.space}), ...(band.straighten === false ? {straighten: false} : {}), ...(band.returns === 'outer' ? {returns: 'all' as const} : {})});
    const at = (id: string) => { const p = must(run.lay.nodes.get(id)); return dir === 'down' ? {x: p.y, y: p.x, w: p.h, h: p.w} : p; };
    return {...run, dir, lines, reserve, top, at};
  };

  const explicitDir = band.dir !== undefined && band.dir !== 'auto';
  const start: 'right' | 'down' = band.dir === 'down' || (band.dir === undefined && band.defaultDir === 'down') ? 'down' : 'right';
  const fitted = fitLayout({
    who: words.who, w, start, keepWords: env.keepWords, alt: start === 'right' ? 'down' : 'right', explicitDir, mode: band.dir === 'auto' ? 'auto' : 'omitted',
    ...(band.maxNodeW === undefined ? {} : {maxNodeW: band.maxNodeW}), build, widthOf: r => r.size.w + r.reserve, best: band.dir === 'auto', ...(heightBudget === undefined ? {} : {heightBudget}),
    ...(band.returns === 'outer' ? {notTried: ["returns: 'inline' (returns is written: 'outer')"]} : {}),
  });
  const {dir, lines, reserve, top, at, lay, routes, size: total} = fitted.result, fitApplied = fitted.applied;



  // a loop sits above its state when the flow runs right (room is made at the top), and to its right when the flow runs down
  // dir down: the loop and its label stick out to the right of the rightmost state (`reserve`)
  const dx = x + (w - total.w - reserve) / 2, dy = y + top;
  const out: LaidOutStates = {
    type: 'states', ...(band.flavor ? {flavor: band.flavor} : {}), id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: total.h + top,
    nodes: [], edges: [], texts: [], icons: [], labels: [], anchors: [], labelBoxes: [],
    ...(fitApplied.length ? {fitApplied} : {}),
  };
  const rects = new Map<string, {x: number; y: number; w: number; h: number}>();
  const diamonds = new Map<string, {x: number; y: number; w: number; h: number}>(); // the diamonds' rects, filled in below
  for (const s of band.states) {
    const p = at(s.id), r = {x: p.x + dx, y: p.y + dy, w: p.w, h: p.h};
    rects.set(s.id, r);
    if (s.shape === 'diamond') diamonds.set(s.id, r);
    out.nodes.push({...r, tone: s.tone ?? 'plain', ...(s.final ? {final: true} : {}), ...(s.shape === 'circle' ? {circle: true} : {}), ...(s.shape === 'diamond' || s.shape === 'pill' ? {shape: s.shape} : {})});
    out.anchors.push({id: s.id, ...r});
    const nl = must(lines.get(s.id)), textH = (nl.label.length * Math.round(roles.body * 1.4)) + (nl.sub.length * Math.round(roles.note * 1.4));
    // the text of a round node sits in its middle; an icon is above the text
    const iconH = s.icon ? ICON_H : 0, y0 = s.shape === 'circle' || s.shape === 'diamond' ? r.y + (r.h - textH - iconH) / 2 - 8 : r.y;
    out.texts.push(...nodeRuns({x: r.x, y: y0 + iconH, w: r.w}, nl, roles));
    if (s.icon) out.icons.push({node: out.nodes.length - 1, name: s.icon, glyph: must(s.iconGlyph), x: r.x + (r.w - STATE_ICON) / 2, y: y0 + 8, size: STATE_ICON});
    out.labelBoxes.push({label: s.label, ...r});
  }
  if (band.initial) { const p = at(INIT); out.initial = {x: p.x + dx + DOT, y: p.y + dy + DOT, r: DOT}; }

  // transitions: routed in the layout's own ('right') axes, then transposed for dir down and moved into the figure
  const used = new Set<number>();
  const pickTransition = (from: string, to: string) => {
    const k = band.transitions.findIndex((tr, i) => !used.has(i) && tr.from === from && tr.to === to);
    if (k >= 0) used.add(k);
    return k >= 0 ? band.transitions[k] : undefined;
  };
  const hit = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  // a label sits on its arrow, in a chip: the middle of the arrow if free, else the nearest spot along it that clears the states and the other chips
  const addLabel = (own: number, text: string, at: (t: number) => Pt, on: Pt[] = []): void => {
    const lw = labelW(text), lh = S + 8;
    const boxAt = (c: Pt) => ({x: c.x - lw / 2, y: c.y - lh / 2, w: lw, h: lh});
    const tip = on.length ? {x: must(on[on.length - 1]).x - ARROW, y: must(on[on.length - 1]).y - ARROW, w: 2 * ARROW, h: 2 * ARROW} : null; // the arrowhead
    // a chip is white: on another arrow it would cut that arrow, so it keeps off every arrow but its own
    const onOther = (b: ReturnType<typeof boxAt>): boolean => out.edges.some((e, k) => k !== own && e.points.slice(1).some((q, m) => {
      const p = must(e.points[m]);
      return hit(b, {x: Math.min(p.x, q.x) - 1, y: Math.min(p.y, q.y) - 1, w: Math.abs(p.x - q.x) + 2, h: Math.abs(p.y - q.y) + 2});
    }));
    const free = (b: ReturnType<typeof boxAt>): boolean => !out.labels.some(o => hit(b, o)) && !out.nodes.some(n => hit(b, n)) && !(tip && hit(b, tip)) && !onOther(b);
    // first choice: beside the arrow's straight runs, last run first (above a horizontal one, to the right of a vertical one)
    const runs: Pt[] = [];
    for (let k = on.length - 2; k >= 0; k--) {
      const p = must(on[k]), q = must(on[k + 1]), last = k === on.length - 2, trim = last ? ARROW : 0;
      if (dir === 'right' && p.y === q.y) {
        const len = Math.abs(q.x - p.x) - trim;
        if (len >= lw) runs.push({x: p.x + Math.sign(q.x - p.x) * (len / 2), y: p.y - lh / 2 - 3});
      } else if (dir === 'down' && p.x === q.x) {
        const len = Math.abs(q.y - p.y) - trim;
        if (len >= lh + 4) runs.push({x: p.x + 6 + lw / 2, y: p.y + Math.sign(q.y - p.y) * (len / 2)}, {x: p.x - 6 - lw / 2, y: p.y + Math.sign(q.y - p.y) * (len / 2)});
      }
    }
    // an arrow that leaves a decision (Yes / No): its chip sits at the diamond, beside the first stretch of the arrow, so it reads as the answer to that question
    const from = diamonds.get(out.edges[own]?.from ?? ''), p0 = on[0];
    if (from && p0) {
      const first = on[1];
      if (dir === 'down' && first && first.x === p0.x) { const right = p0.x >= from.x + from.w / 2; runs.unshift({x: p0.x + (right ? 1 : -1) * (6 + lw / 2), y: from.y + from.h + lh / 2 + 2}); }
      else if (dir === 'right' && first && first.y === p0.y) runs.unshift({x: from.x + from.w + 4 + lw / 2, y: p0.y + (p0.y < from.y + from.h / 2 ? -1 : 1) * (lh / 2 + 3)});
    }
    // candidates, nearest to the arrow first: its straight runs, then points along it, then spots beside those (right / left / above / below)
    const offs: [number, number][] = [[0, 0], [lw / 2 + 8, 0], [-(lw / 2 + 8), 0], [0, lh + 2], [0, -(lh + 2)], [lw / 2 + 8, lh + 2], [-(lw / 2 + 8), lh + 2], [lw / 2 + 8, -(lh + 2)], [-(lw / 2 + 8), -(lh + 2)], [0, 2 * (lh + 2)], [0, -2 * (lh + 2)], [lw + 12, 0], [-(lw + 12), 0]];
    const cands: {p: Pt; cost: number}[] = runs.map(p => ({p, cost: -1}));
    for (let f = 0.05; f < 0.96; f += 0.05) for (const [ox, oy] of offs) { const q = at(f); cands.push({p: {x: q.x + ox, y: q.y + oy}, cost: Math.hypot(ox, oy) + Math.abs(f - 0.5) * 30}); }
    cands.sort((u, v) => u.cost - v.cost);
    const c = must(cands.find(k => free(boxAt(k.p))) ?? cands[0]).p;
    const b = boxAt(c);
    out.labels.push({text, ...b, tx: c.x, ty: b.y + S + 2, size: S, edge: own});
    out.labelBoxes.push({label: text, ...b});
  };
  // every arrow is routed first, then the labels are placed (a chip must know where the other arrows run)
  const pending: {edge: number; text: string; at: (t: number) => Pt; on?: Pt[]}[] = [];
  for (const [i, e] of lay.edges.entries()) {
    const t = e.from === INIT ? undefined : pickTransition(e.from, e.to);
    if (e.self) {
      const a = must(rects.get(e.from)), cx = a.x + a.w / 2, cy = a.y + a.h / 2;
      if (dir === 'down') {
        const pts = [{x: a.x + a.w, y: cy - LOOP_W}, {x: a.x + a.w + LOOP, y: cy - LOOP_W}, {x: a.x + a.w + LOOP, y: cy + LOOP_W}, {x: a.x + a.w, y: cy + LOOP_W}];
        out.edges.push({from: e.from, to: e.to, points: pts, line: t?.line ?? 'solid', ...(t?.tone ? {tone: t.tone} : {}), ...(t?.strong ? {strong: true} : {})});
        if (t?.label) { const lw = labelW(t.label); pending.push({edge: out.edges.length - 1, text: t.label, at: () => ({x: a.x + a.w + LOOP + 4 + lw / 2, y: cy})}); }
        continue;
      }
      const pts = [{x: cx + LOOP_W, y: a.y}, {x: cx + LOOP_W, y: a.y - LOOP}, {x: cx - LOOP_W, y: a.y - LOOP}, {x: cx - LOOP_W, y: a.y}];
      out.edges.push({from: e.from, to: e.to, points: pts, line: t?.line ?? 'solid', ...(t?.tone ? {tone: t.tone} : {}), ...(t?.strong ? {strong: true} : {})});
      if (t?.label) pending.push({edge: out.edges.length - 1, text: t.label, at: () => ({x: cx, y: a.y - LOOP - (S + 8) / 2 - 2})});
      continue;
    }
    const pts = must(routes.get(i)).slice();
    // an end on a diamond is moved onto its outline (the arrows that share a side are spread around its middle)
    const dFrom = diamonds.get(e.from), dTo = diamonds.get(e.to);
    if (dFrom && pts.length > 1) pts[0] = ontoDiamond(must(pts[0]), must(pts[1]), dFrom);
    if (dTo && pts.length > 1) pts[pts.length - 1] = ontoDiamond(must(pts[pts.length - 1]), must(pts[pts.length - 2]), dTo);
    out.edges.push({from: e.from, to: e.to, points: pts, line: t?.line ?? 'solid', ...(t?.tone ? {tone: t.tone} : {}), ...(t?.strong ? {strong: true} : {})});
    if (t?.label) pending.push({edge: out.edges.length - 1, text: t.label, at: f => pointAt(pts, f), on: pts});
  }
  for (const p of pending) addLabel(p.edge, p.text, p.at, p.on);
  return out;
}
