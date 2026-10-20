// bpmn(): a business flow in lanes (pools' lanes), BPMN-style: tasks, start / end events and gateways (exclusive, parallel,
// inclusive), joined by sequence flows (solid) and message flows (dashed). Lanes are given; the columns come from the flow
// (graph-layout.ts layoutLayered, used for the layer of each node), the rows from the lane. Only the shapes and flow rules
// that most flow diagrams use are here — not the whole standard.
import {textWidth} from './atoms.ts';
import {layoutLayered} from './graph-layout.ts';
import type {Pt} from './graph-layout.ts';
import {measureNode, narrowField, nodeRuns} from './tree.ts';
import type {NodeLines} from './tree.ts';
import {wrapText} from './wrap.ts';
import type {FontFamily, Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {BpmnBand, BpmnNodeKind, LaidOutBpmn} from './types/diagrams.ts';

import {must} from './must.ts';
const LABEL_COL = 120, PAD_Y = 22, COL_GAP = 52, EVENT = 36, GATE = 44, TASK_MAX = 168, LABEL_MAX = 120, STUB = 16, CHIP_PAD = 5;
const TASK_ICON = 20, ICON_H = TASK_ICON + 4; // an icon above a task's label: its size and the room it takes
const lineH = (s: number): number => Math.round(s * 1.4);
const isEvent = (k: BpmnNodeKind): boolean => k === 'start' || k === 'end';
const isGate = (k: BpmnNodeKind): boolean => k === 'xor' || k === 'and' || k === 'or';
export const BPMN_KINDS = ['task', 'start', 'end', 'xor', 'and', 'or'] as const;

export function bpmnTexts(band: BpmnBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const l of band.lanes) out.push([l.label, roles.body, 700, 'sans']);
  for (const n of band.nodes) out.push([n.label ?? '', roles.body, (n.kind ?? 'task') === 'task' ? 700 : 400, 'sans'], [n.sub ?? '', roles.note, 400, 'sans']);
  for (const f of band.flows) if (f.label) out.push([f.label, roles.note, 400, 'sans']);
  return out;
}

/** fit: 'shrink' tries these in order until the figure fits: narrower lane-name column, tighter column gaps, narrower task boxes. */
const SHRINK_STEPS: BpmnMetrics[] = [
  {labelCol: LABEL_COL, colGap: COL_GAP, taskMax: TASK_MAX, flowRoom: 2 * STUB},
  {labelCol: 96, colGap: 36, taskMax: 140, flowRoom: STUB},
  {labelCol: 80, colGap: 28, taskMax: 116, flowRoom: 0},
  {labelCol: 64, colGap: 22, taskMax: 96, flowRoom: null},
  {labelCol: 64, colGap: 16, taskMax: 80, flowRoom: null},
];
/** flowRoom: the extra width a column gap keeps beside the widest flow label; null keeps none (a label then sits wherever beside its flow is free). */
interface BpmnMetrics {labelCol: number; colGap: number; taskMax: number; flowRoom: number | null}

export function layoutBpmn(band: BpmnBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutBpmn {
  const steps = band.fit === 'shrink' ? SHRINK_STEPS : SHRINK_STEPS.slice(0, 1);
  for (const m of steps.slice(0, -1)) { const out = layoutBpmnAt(band, x, y, w, widthOf, roles, env, m, false); if (out) return out; }
  return layoutBpmnAt(band, x, y, w, widthOf, roles, env, must(steps[steps.length - 1]), true);
}

function layoutBpmnAt(band: BpmnBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, metrics: BpmnMetrics, final: true): LaidOutBpmn;
function layoutBpmnAt(band: BpmnBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, metrics: BpmnMetrics, final: boolean): LaidOutBpmn | null;
function layoutBpmnAt(band: BpmnBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, metrics: BpmnMetrics, final: boolean): LaidOutBpmn | null {
  const {labelCol: LABEL_COL, taskMax: TASK_MAX, flowRoom} = metrics, COL_GAP = Math.round(metrics.colGap * (env.space ?? 1));
  const B = roles.body, S = roles.note;
  const laneIdx = new Map(band.lanes.map((l, i) => [l.id, i]));
  if (laneIdx.size !== band.lanes.length) throw new Error('bpmn(): duplicate lane id');
  const ids = new Set<string>();
  for (const n of band.nodes) {
    if (typeof n.id !== 'string' || !n.id) throw new Error('bpmn(): every node needs an id');
    if (ids.has(n.id)) throw new Error(`bpmn(): duplicate node id "${n.id}"`);
    ids.add(n.id);
    if (!laneIdx.has(n.lane)) throw new Error(`bpmn(): node "${n.id}" uses unknown lane "${n.lane}"`);
    const k = n.kind ?? 'task';
    if (!(BPMN_KINDS as readonly string[]).includes(k)) throw new Error(`bpmn(): node "${n.id}" has kind ${String(k)} (use ${BPMN_KINDS.join(' | ')})`);
    if (k === 'task' && !(n.label ?? '').trim()) throw new Error(`bpmn(): task "${n.id}" needs a label`);
    if ((n.icon !== undefined || n.iconTone !== undefined) && k !== 'task') throw new Error(`bpmn(): node "${n.id}" is a ${k} event/gateway; only a task takes an icon`);
    if (n.iconTone !== undefined && n.icon === undefined) throw new Error(`bpmn(): node "${n.id}" has iconTone but no icon`);
  }
  for (const f of band.flows) for (const e of [f.from, f.to]) if (!ids.has(e)) throw new Error(`bpmn(): flow ${f.from} -> ${f.to} names unknown node "${e}"`);
  const kindOf = new Map(band.nodes.map(n => [n.id, n.kind ?? 'task' as BpmnNodeKind]));
  for (const f of band.flows) {
    if (kindOf.get(f.to) === 'start') throw new Error(`bpmn(): flow ${f.from} -> ${f.to}: a start event takes no flow into it (a message start event is not drawn; start from a task instead)`);
    if (kindOf.get(f.from) === 'end') throw new Error(`bpmn(): flow ${f.from} -> ${f.to}: an end event has no flow out of it`);
  }

  // size of each node (the shape; an event / gateway label hangs below it)
  interface M {w: number; h: number; lines?: NodeLines; label: string[]; extent: number}
  const meas = new Map<string, M>();
  for (const n of band.nodes) {
    const k = must(kindOf.get(n.id)); // kindOf has every node
    if (k === 'task') { const m = measureNode(must(n.label), n.sub, TASK_MAX, widthOf, roles, env.wrap, env.keepWords, {keepWordsCap: 168 - 28}); const h = m.h + (n.icon ? ICON_H : 0); meas.set(n.id, {w: m.w, h, lines: m, label: [], extent: h}); continue; }
    const size = isEvent(k) ? EVENT : GATE;
    const label = n.label ? wrapText(n.label, {maxWidth: LABEL_MAX, atomWidth: a => widthOf(a, B, 400, 'sans'), mode: env.wrap}) : [];
    meas.set(n.id, {w: size, h: size, label, extent: size + (label.length ? 4 + label.length * lineH(B) : 0)});
  }
  const labelWidth = (m: M): number => Math.max(m.w, ...m.label.map(l => Math.ceil(textWidth(widthOf, l, B, 400))));

  // columns: the layer of each node along the flow (starts first)
  const lay = layoutLayered(
    band.nodes.map(n => ({id: n.id, size: {w: must(meas.get(n.id)).w, h: must(meas.get(n.id)).h}})),
    band.flows.map(f => ({from: f.from, to: f.to})),
    {start: band.nodes.filter(n => kindOf.get(n.id) === 'start').map(n => n.id), tighten: false}, // the column is the layer: a node moving would move the whole figure
  );
  const nLayers = Math.max(...[...lay.layers.values()]) + 1;
  const colW = Array.from({length: nLayers}, () => 0);
  for (const n of band.nodes) { const c = must(lay.layers.get(n.id)), m = must(meas.get(n.id)); colW[c] = Math.max(must(colW[c]), labelWidth(m)); }
  const widestFlow = Math.max(0, ...band.flows.map(f => f.label ? Math.ceil(textWidth(widthOf, f.label, S, 400)) + 2 * CHIP_PAD : 0));
  const gap = flowRoom === null ? COL_GAP : Math.max(COL_GAP, widestFlow + flowRoom);
  const colX: number[] = [];
  colW.reduce((a, cw, i) => (colX[i] = a, a + cw + gap), x + LABEL_COL + gap / 2);
  const total = must(colX[nLayers - 1]) + must(colW[nLayers - 1]) + gap / 2 - x;
  if (total > w + 0.5) {
    if (!final) return null;
    throw new Error(`bpmn(): the figure is ${Math.ceil(total)}px wide but it has ${Math.round(w)}px (${band.fit === 'shrink' ? 'even shrunk; ' : "set fit: 'shrink', "}merge steps, shorten labels, or split the flow into two figures)`);
  }
  const width = w;

  // rows: each lane is as tall as its tallest stack of nodes that share a column
  const stacks = new Map<string, string[]>();
  for (const n of band.nodes) { const k = `${laneIdx.get(n.lane)}:${lay.layers.get(n.id)}`; stacks.set(k, [...(stacks.get(k) ?? []), n.id]); }
  const laneLines = band.lanes.map(l => wrapText(l.label, {maxWidth: LABEL_COL - 16, atomWidth: a => widthOf(a, B, 700, 'sans'), mode: env.wrap}));
  const laneH = band.lanes.map((_, li) => {
    let h = must(laneLines[li]).length * lineH(B) + 2 * PAD_Y; // the lane's name must fit its row
    for (const [k, list] of stacks) {
      if (!k.startsWith(`${li}:`)) continue;
      // a lone shape sits on the lane's centre line (so a flow between lone shapes is straight); its label hangs below
      if (list.length === 1) { const id = must(list[0]), m = must(meas.get(id)), block = m.extent - m.h; h = Math.max(h, 2 * (m.h / 2 + block)); }
      else h = Math.max(h, list.reduce((s, id, i) => s + must(meas.get(id)).extent + (i ? 16 : 0), 0));
    }
    return Math.max(88, h + 2 * PAD_Y, must(laneLines[li]).length * lineH(B) + 2 * PAD_Y);
  });
  const laneTop: number[] = [];
  laneH.reduce((a, h, i) => (laneTop[i] = a, a + h), y);
  const out: LaidOutBpmn = {
    type: 'bpmn', ...(band.fit === 'shrink' ? narrowField(band.nodes.filter(n => kindOf.get(n.id) === 'task').map(n => must(must(meas.get(n.id)).lines).label)) : {}), id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w: width, h: laneH.reduce((a, b) => a + b, 0),
    lanes: [], nodes: [], icons: [], edges: [], texts: [], labels: [], anchors: [], labelBoxes: [],
  };
  band.lanes.forEach((l, i) => {
    out.lanes.push({x, y: must(laneTop[i]), w: width, h: must(laneH[i]), labelW: LABEL_COL, tone: l.tone ?? 'plain'});
    const lines = must(laneLines[i]);
    const top = must(laneTop[i]) + must(laneH[i]) / 2 - (lines.length * lineH(B)) / 2;
    lines.forEach((ln, k) => out.texts.push({text: ln, x: x + LABEL_COL / 2, y: top + k * lineH(B) + B, size: B, bold: true, muted: false, anchor: 'middle'}));
  });

  // place nodes: column centre, stacked and centred in the lane
  const rect = new Map<string, {x: number; y: number; w: number; h: number}>();
  for (const [k, list] of stacks) {
    const li = Number(k.split(':')[0]), c = Number(k.split(':')[1]), first = must(list[0]), top0 = must(laneTop[li]), high = must(laneH[li]);
    const sum = list.reduce((s, id, i) => s + must(meas.get(id)).extent + (i ? 16 : 0), 0);
    let ty = list.length === 1 ? top0 + high / 2 - must(meas.get(first)).h / 2 : top0 + (high - sum) / 2;
    if (list.length > 1 && isGate(must(kindOf.get(first)))) ty += must(meas.get(first)).extent - must(meas.get(first)).h; // a gateway's label sits above it
    const cx = must(colX[c]) + must(colW[c]) / 2;
    for (const id of list) {
      const m = must(meas.get(id));
      rect.set(id, {x: cx - m.w / 2, y: ty, w: m.w, h: m.h});
      ty += m.extent + 16;
    }
  }
  const labelOfNode = new Set<object>(); // the nodes' own boxes in labelBoxes (they are checked as rects, not as labels)
  for (const n of band.nodes) {
    const r = must(rect.get(n.id)), m = must(meas.get(n.id)), k = must(kindOf.get(n.id));
    out.nodes.push({...r, kind: k, tone: n.tone ?? 'plain'});
    out.anchors.push({id: n.id, ...r});
    const nb = {label: n.label ?? n.id, x: r.x, y: r.y, w: r.w, h: r.h};
    out.labelBoxes.push(nb);
    labelOfNode.add(nb);
    const iconH = n.icon ? ICON_H : 0;
    if (n.icon) out.icons.push({node: out.nodes.length - 1, name: n.icon, glyph: must(n.iconGlyph), x: r.x + (r.w - TASK_ICON) / 2, y: r.y + 8, size: TASK_ICON, ...(n.iconTone ? {tone: n.iconTone} : {})});
    if (m.lines) out.texts.push(...nodeRuns({...r, y: r.y + iconH}, m.lines, roles).map(t => ({...t, anchor: 'middle' as const})));
    else if (!isGate(k)) m.label.forEach((ln, i) => { // an event's label hangs below it (a gateway's is placed after the flows are known)
      const tw = Math.ceil(textWidth(widthOf, ln, B, 400)), ty = r.y + r.h + 4 + i * lineH(B) + B;
      out.texts.push({text: ln, x: r.x + r.w / 2, y: ty, size: B, bold: false, muted: false, anchor: 'middle'});
      out.labelBoxes.push({label: ln, x: r.x + r.w / 2 - tw / 2, y: ty - B, w: tw, h: B + 4});
    });
  }

  // flows
  const hit = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const segBox = (p: Pt, q: Pt) => ({x: Math.min(p.x, q.x) - 1, y: Math.min(p.y, q.y) - 1, w: Math.abs(p.x - q.x) + 2, h: Math.abs(p.y - q.y) + 2});
  const through = (pts: Pt[], skip: string[]): boolean => pts.slice(1).some((q, i) => [...rect].some(([id, r]) => !skip.includes(id) && hit(segBox(must(pts[i]), q), r)));
  const simplify = (pts: Pt[]): Pt[] => {
    const o: Pt[] = [];
    for (const p of pts) if (!o.length || Math.abs(must(o[o.length - 1]).x - p.x) > 0.01 || Math.abs(must(o[o.length - 1]).y - p.y) > 0.01) o.push(p);
    return o.filter((p, i) => i === 0 || i === o.length - 1 || !((must(o[i - 1]).x === p.x && p.x === must(o[i + 1]).x) || (must(o[i - 1]).y === p.y && p.y === must(o[i + 1]).y)));
  };
  const lane = (id: string): number => must(laneIdx.get(must(band.nodes.find(n => n.id === id)).lane));
  const colOf = (id: string): number => must(lay.layers.get(id));
  const colSeen = new Map<number, number>();
  const pending: (() => void)[] = [];
  band.flows.forEach((f, fi) => {
    const A = must(rect.get(f.from)), Bx = must(rect.get(f.to)), ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: Bx.x + Bx.w / 2, y: Bx.y + Bx.h / 2};
    const line = f.line === 'dashed' ? 'dashed' : 'solid';
    let pts: Pt[];
    if (f.from === f.to) {
      pts = [{x: A.x + A.w, y: ca.y - 8}, {x: A.x + A.w + 22, y: ca.y - 8}, {x: A.x + A.w + 22, y: ca.y + 8}, {x: A.x + A.w, y: ca.y + 8}];
    } else if (Bx.x > A.x + A.w - 1) { // forward: out of the right (or the top / bottom vertex of a gateway), into the left
      const gate = isGate(must(kindOf.get(f.from))), sameRow = Math.abs(ca.y - cb.y) < 1;
      const k = colSeen.get(colOf(f.to)) ?? 0; colSeen.set(colOf(f.to), k + 1);
      const xm = Bx.x - STUB - (k % 3) * 8, end = {x: Bx.x, y: cb.y};
      if (sameRow) pts = [{x: A.x + A.w, y: ca.y}, end];
      else if (gate) pts = [{x: ca.x, y: cb.y < ca.y ? A.y : A.y + A.h}, {x: ca.x, y: cb.y}, end];
      else pts = [{x: A.x + A.w, y: ca.y}, {x: xm, y: ca.y}, {x: xm, y: cb.y}, end];
      pts = simplify(pts);
      if (through(pts, [f.from, f.to])) { // something stands in the way: run along a lane's edge, turning in a gap between columns
        const cf = colOf(f.from), ct = colOf(f.to), start = {x: A.x + A.w, y: ca.y};
        const channels = [must(laneTop[lane(f.to)]) + 8, must(laneTop[lane(f.to)]) + must(laneH[lane(f.to)]) - 8, must(laneTop[lane(f.from)]) + 8, must(laneTop[lane(f.from)]) + must(laneH[lane(f.from)]) - 8];
        const outs = [A.x + A.w + STUB, must(colX[cf]) + must(colW[cf]) + gap / 2], ins = [Bx.x - STUB, must(colX[ct]) - gap / 2];
        const tries = channels.flatMap(ch => outs.flatMap(xo => ins.map(xi => simplify([start, {x: xo, y: ca.y}, {x: xo, y: ch}, {x: xi, y: ch}, {x: xi, y: cb.y}, end]))));
        pts = tries.find(t => !through(t, [f.from, f.to])) ?? must(tries[0]);
      }
    } else { // back (or into the same column): out of the bottom, along under the lane's content, into the bottom
      // under both ends, and under any node that the run passes beneath and that reaches below them (a tall task between the two)
      let base = Math.max(A.y + A.h, Bx.y + Bx.h);
      const lo = Math.min(ca.x, cb.x), hi = Math.max(ca.x, cb.x);
      for (let moved = true; moved;) {
        moved = false;
        for (const r of rect.values()) if (r.x < hi && r.x + r.w > lo && r.y < base && r.y + r.h > base) { base = r.y + r.h; moved = true; }
      }
      const yb = base + 14 + (fi % 3) * 7;
      pts = simplify([{x: ca.x, y: A.y + A.h}, {x: ca.x, y: yb}, {x: cb.x, y: yb}, {x: cb.x, y: Bx.y + Bx.h}]);
    }
    out.edges.push({from: f.from, to: f.to, line, points: pts});
    const own = out.edges.length - 1;
    if (f.label) pending.push(() => {
      const p0 = must(pts[0]), p1 = must(pts[1]), pn = must(pts[pts.length - 1]), lw = Math.ceil(textWidth(widthOf, must(f.label), S, 400)) + 2 * CHIP_PAD;
      const horiz = p0.y === p1.y, self = f.from === f.to;
      // a condition belongs at the start of the flow, beside its first run; then anywhere beside the flow, nearest first
      const near: Pt[] = self ? [{x: A.x + A.w + 26 + lw / 2, y: ca.y}, {x: A.x + A.w + 26 + lw / 2, y: ca.y - 24}]
        : horiz ? [{x: p0.x + 8 + (Math.abs(p1.x - p0.x) - 8) / 2, y: p0.y - 14}, {x: (p0.x + pn.x) / 2, y: p0.y - 14}, {x: p0.x + 8 + (Math.abs(p1.x - p0.x) - 8) / 2, y: p0.y + 14}]
        : [{x: p0.x + 40, y: p1.y > p0.y ? p0.y + 18 : p0.y - 18}, {x: p0.x - 40, y: p1.y > p0.y ? p0.y + 18 : p0.y - 18}, {x: p0.x + 30, y: (p0.y + p1.y) / 2}];
      const more = pts.slice(1).flatMap((q, i) => { const m = {x: (must(pts[i]).x + q.x) / 2, y: (must(pts[i]).y + q.y) / 2}; const offs: [number, number][] = [[0, -16], [0, 16], [lw / 2 + 8, 0], [-(lw / 2 + 8), 0], [lw / 2 + 8, -16], [-(lw / 2 + 8), 16]]; return offs.map(([ox, oy]) => ({x: m.x + ox, y: m.y + oy})); });
      chip(own, must(f.label), [...near, ...more]);
    });
  });
  // chips are white: one on another flow would cut it, so each keeps off every flow but its own, off the nodes and the other chips
  const chip = (own: number, text: string, cands: Pt[]): void => {
    const lw = Math.ceil(textWidth(widthOf, text, S, 400)) + 2 * CHIP_PAD, lh = S + 8;
    const box = (c: Pt) => ({x: c.x - lw / 2, y: c.y - lh / 2, w: lw, h: lh});
    const free = (b: ReturnType<typeof box>): boolean => !out.labels.some(o => hit(b, o)) && ![...rect.values()].some(r => hit(b, r)) && !out.labelBoxes.some(o => hit(b, o) && !labelOfNode.has(o))
      && !out.edges.some((e, k) => k !== own && e.points.slice(1).some((q, m) => hit(b, segBox(must(e.points[m]), q)))) && b.x >= x + LABEL_COL && b.x + b.w <= x + width;
    const c = must(cands.find(p => free(box(p))) ?? cands[0]), b = box(c);
    out.labels.push({text, ...b, tx: c.x, ty: b.y + S + 2, size: S, edge: own});
    out.labelBoxes.push({label: text, ...b});
  };
  for (const p of pending) p();

  // a gateway's label: above or below, to the left or right of its vertex, in the first spot clear of nodes, flows, chips and the lane names
  for (const n of band.nodes) {
    const m = must(meas.get(n.id)), r = must(rect.get(n.id));
    if (!isGate(must(kindOf.get(n.id))) || !m.label.length) continue;
    const lh = lineH(B), bh = m.label.length * lh, bw = Math.max(...m.label.map(l => Math.ceil(textWidth(widthOf, l, B, 400)))), cx = r.x + r.w / 2;
    const spots = [
      {x: cx - bw, y: r.y - 4 - bh, a: 'end' as const}, {x: cx, y: r.y - 4 - bh, a: 'start' as const},
      {x: cx - bw, y: r.y + r.h + 4, a: 'end' as const}, {x: cx, y: r.y + r.h + 4, a: 'start' as const},
    ];
    const free = (s: {x: number; y: number}): boolean => {
      const b = {x: s.x, y: s.y, w: bw, h: bh};
      return s.x >= x + LABEL_COL + 2 && s.x + bw <= x + width && s.y >= y && s.y + bh <= y + out.h
        && ![...rect.values()].some(q => hit(b, q)) && !out.labels.some(q => hit(b, q)) && !out.labelBoxes.some(q => hit(b, q) && !labelOfNode.has(q)) && !out.edges.some(e => e.points.slice(1).some((q2, i) => hit(b, segBox(must(e.points[i]), q2))));
    };
    const s = spots.find(free) ?? must(spots[0]);
    m.label.forEach((ln, i) => {
      const tw = Math.ceil(textWidth(widthOf, ln, B, 400)), ty = s.y + i * lh + B;
      out.texts.push({text: ln, x: s.a === 'end' ? cx : cx, y: ty, size: B, bold: false, muted: false, anchor: s.a});
      out.labelBoxes.push({label: ln, x: s.a === 'end' ? cx - tw : cx, y: ty - B, w: tw, h: B + 4});
    });
  }
  return out;
}
