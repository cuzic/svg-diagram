// bpmn(): a business flow in lanes (pools' lanes), BPMN-style: tasks, start / end events and gateways (exclusive, parallel,
// inclusive), joined by sequence flows (solid) and message flows (dashed). Lanes are given; the columns come from the flow
// (graph-layout.ts layoutLayered, used for the layer of each node), the rows from the lane. Only the shapes and flow rules
// that most flow diagrams use are here — not the whole standard.
import {textWidth} from './atoms.ts';
import {layoutLayered} from './graph-layout.ts';
import type {Pt} from './graph-layout.ts';
import {measureNode, nodeRuns} from './tree.ts';
import type {NodeLines} from './tree.ts';
import {wrapText} from './wrap.ts';
import type {BpmnBand, BpmnNodeKind, FontFamily, LaidOutBpmn, Roles, WidthOf} from './types.ts';

const LABEL_COL = 120, PAD_Y = 22, COL_GAP = 52, EVENT = 36, GATE = 44, TASK_MAX = 168, LABEL_MAX = 120, STUB = 16, CHIP_PAD = 5, ARROW = 12;
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

export function layoutBpmn(band: BpmnBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutBpmn {
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
  }
  for (const f of band.flows) for (const e of [f.from, f.to]) if (!ids.has(e)) throw new Error(`bpmn(): flow ${f.from} -> ${f.to} names unknown node "${e}"`);
  const kindOf = new Map(band.nodes.map(n => [n.id, n.kind ?? 'task' as BpmnNodeKind]));

  // size of each node (the shape; an event / gateway label hangs below it)
  interface M {w: number; h: number; lines?: NodeLines; label: string[]; extent: number}
  const meas = new Map<string, M>();
  for (const n of band.nodes) {
    const k = kindOf.get(n.id)!;
    if (k === 'task') { const m = measureNode(n.label!, n.sub, TASK_MAX, widthOf, roles); meas.set(n.id, {w: m.w, h: m.h, lines: m, label: [], extent: m.h}); continue; }
    const size = isEvent(k) ? EVENT : GATE;
    const label = n.label ? wrapText(n.label, {maxWidth: LABEL_MAX, atomWidth: a => widthOf(a, B, 400, 'sans')}) : [];
    meas.set(n.id, {w: size, h: size, label, extent: size + (label.length ? 4 + label.length * lineH(B) : 0)});
  }
  const labelWidth = (m: M): number => Math.max(m.w, ...m.label.map(l => Math.ceil(textWidth(widthOf, l, B, 400))));

  // columns: the layer of each node along the flow (starts first)
  const lay = layoutLayered(
    band.nodes.map(n => ({id: n.id, size: {w: meas.get(n.id)!.w, h: meas.get(n.id)!.h}})),
    band.flows.map(f => ({from: f.from, to: f.to})),
    {start: band.nodes.filter(n => kindOf.get(n.id) === 'start').map(n => n.id)},
  );
  const nLayers = Math.max(...[...lay.layers.values()]) + 1;
  const colW = Array.from({length: nLayers}, () => 0);
  for (const n of band.nodes) { const c = lay.layers.get(n.id)!, m = meas.get(n.id)!; colW[c] = Math.max(colW[c], labelWidth(m)); }
  const widestFlow = Math.max(0, ...band.flows.map(f => f.label ? Math.ceil(textWidth(widthOf, f.label, S, 400)) + 2 * CHIP_PAD : 0));
  const gap = Math.max(COL_GAP, widestFlow + 2 * STUB);
  const colX: number[] = [];
  colW.reduce((a, cw, i) => (colX[i] = a, a + cw + gap), x + LABEL_COL + gap / 2);
  const total = colX[nLayers - 1] + colW[nLayers - 1] + gap / 2 - x;
  if (total > w + 0.5) throw new Error(`bpmn(): the figure is ${Math.ceil(total)}px wide but it has ${Math.round(w)}px (merge steps, shorten labels, or split the flow into two figures)`);
  const width = w;

  // rows: each lane is as tall as its tallest stack of nodes that share a column
  const stacks = new Map<string, string[]>();
  for (const n of band.nodes) { const k = `${laneIdx.get(n.lane)}:${lay.layers.get(n.id)}`; stacks.set(k, [...(stacks.get(k) ?? []), n.id]); }
  const laneH = band.lanes.map((_, li) => {
    let h = 0;
    for (const [k, list] of stacks) {
      if (!k.startsWith(`${li}:`)) continue;
      // a lone shape sits on the lane's centre line (so a flow between lone shapes is straight); its label hangs below
      if (list.length === 1) { const id = list[0], m = meas.get(id)!, block = m.extent - m.h; h = Math.max(h, 2 * (m.h / 2 + block)); }
      else h = Math.max(h, list.reduce((s, id, i) => s + meas.get(id)!.extent + (i ? 16 : 0), 0));
    }
    return Math.max(88, h + 2 * PAD_Y);
  });
  const laneTop: number[] = [];
  laneH.reduce((a, h, i) => (laneTop[i] = a, a + h), y);
  const out: LaidOutBpmn = {
    type: 'bpmn', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w: width, h: laneH.reduce((a, b) => a + b, 0),
    lanes: [], nodes: [], edges: [], texts: [], labels: [], anchors: [], labelBoxes: [],
  };
  band.lanes.forEach((l, i) => {
    out.lanes.push({x, y: laneTop[i], w: width, h: laneH[i], labelW: LABEL_COL, tone: l.tone ?? 'plain'});
    const lines = wrapText(l.label, {maxWidth: LABEL_COL - 16, atomWidth: a => widthOf(a, B, 700, 'sans')});
    const top = laneTop[i] + laneH[i] / 2 - (lines.length * lineH(B)) / 2;
    lines.forEach((ln, k) => out.texts.push({text: ln, x: x + LABEL_COL / 2, y: top + k * lineH(B) + B, size: B, bold: true, muted: false, anchor: 'middle'}));
  });

  // place nodes: column centre, stacked and centred in the lane
  const rect = new Map<string, {x: number; y: number; w: number; h: number}>();
  for (const [k, list] of stacks) {
    const [li, c] = k.split(':').map(Number);
    const sum = list.reduce((s, id, i) => s + meas.get(id)!.extent + (i ? 16 : 0), 0);
    let ty = list.length === 1 ? laneTop[li] + laneH[li] / 2 - meas.get(list[0])!.h / 2 : laneTop[li] + (laneH[li] - sum) / 2;
    if (list.length > 1 && isGate(kindOf.get(list[0])!)) ty += meas.get(list[0])!.extent - meas.get(list[0])!.h; // a gateway's label sits above it
    const cx = colX[c] + colW[c] / 2;
    for (const id of list) {
      const m = meas.get(id)!;
      rect.set(id, {x: cx - m.w / 2, y: ty, w: m.w, h: m.h});
      ty += m.extent + 16;
    }
  }
  for (const n of band.nodes) {
    const r = rect.get(n.id)!, m = meas.get(n.id)!, k = kindOf.get(n.id)!;
    out.nodes.push({...r, kind: k, tone: n.tone ?? 'plain'});
    out.anchors.push({id: n.id, ...r});
    out.labelBoxes.push({label: n.label ?? n.id, x: r.x, y: r.y, w: r.w, h: r.h});
    if (m.lines) out.texts.push(...nodeRuns(r, m.lines, roles).map(t => ({...t, anchor: 'middle' as const})));
    else m.label.forEach((ln, i) => {
      const tw = Math.ceil(textWidth(widthOf, ln, B, 400));
      if (isGate(k)) { // above the shape, ending at its left vertex: a flow leaves it to the right, up or down, and enters from the left
        const ty = r.y - 4 - (m.label.length - 1 - i) * lineH(B) - 4;
        out.texts.push({text: ln, x: r.x + r.w / 2, y: ty, size: B, bold: false, muted: false, anchor: 'end'});
        out.labelBoxes.push({label: ln, x: r.x + r.w / 2 - tw, y: ty - B, w: tw, h: B + 4});
      } else {
        const ty = r.y + r.h + 4 + i * lineH(B) + B;
        out.texts.push({text: ln, x: r.x + r.w / 2, y: ty, size: B, bold: false, muted: false, anchor: 'middle'});
        out.labelBoxes.push({label: ln, x: r.x + r.w / 2 - tw / 2, y: ty - B, w: tw, h: B + 4});
      }
    });
  }

  // flows
  const hit = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const through = (pts: Pt[], skip: string[]): boolean => pts.slice(1).some((q, i) => {
    const p = pts[i], seg = {x: Math.min(p.x, q.x) - 1, y: Math.min(p.y, q.y) - 1, w: Math.abs(p.x - q.x) + 2, h: Math.abs(p.y - q.y) + 2};
    return [...rect].some(([id, r]) => !skip.includes(id) && hit(seg, r));
  });
  const simplify = (pts: Pt[]): Pt[] => {
    const o: Pt[] = [];
    for (const p of pts) if (!o.length || Math.abs(o[o.length - 1].x - p.x) > 0.01 || Math.abs(o[o.length - 1].y - p.y) > 0.01) o.push(p);
    return o.filter((p, i) => i === 0 || i === o.length - 1 || !((o[i - 1].x === p.x && p.x === o[i + 1].x) || (o[i - 1].y === p.y && p.y === o[i + 1].y)));
  };
  const lane = (id: string): number => laneIdx.get(band.nodes.find(n => n.id === id)!.lane)!;
  const colSeen = new Map<number, number>();
  const placedLabels: {x: number; y: number; w: number; h: number}[] = [];
  const addLabel = (text: string, cands: Pt[]): void => {
    const lw = Math.ceil(textWidth(widthOf, text, S, 400)) + 2 * CHIP_PAD, lh = S + 8;
    const box = (c: Pt) => ({x: c.x - lw / 2, y: c.y - lh / 2, w: lw, h: lh});
    const free = (b: ReturnType<typeof box>): boolean => !placedLabels.some(o => hit(b, o)) && ![...rect.values()].some(r => hit(b, r));
    const c = cands.find(p => free(box(p))) ?? cands[0], b = box(c);
    placedLabels.push(b);
    out.labels.push({text, ...b, tx: c.x, ty: b.y + S + 2});
    out.labelBoxes.push({label: text, ...b});
  };
  band.flows.forEach((f, fi) => {
    const A = rect.get(f.from)!, Bx = rect.get(f.to)!, ca = {x: A.x + A.w / 2, y: A.y + A.h / 2}, cb = {x: Bx.x + Bx.w / 2, y: Bx.y + Bx.h / 2};
    const line = f.line === 'dashed' ? 'dashed' : 'solid';
    let pts: Pt[];
    if (f.from === f.to) {
      pts = [{x: A.x + A.w, y: ca.y - 8}, {x: A.x + A.w + 22, y: ca.y - 8}, {x: A.x + A.w + 22, y: ca.y + 8}, {x: A.x + A.w, y: ca.y + 8}];
    } else if (Bx.x > A.x + A.w - 1) { // forward: out of the right (or the top / bottom vertex of a gateway), into the left
      const gate = isGate(kindOf.get(f.from)!), sameRow = Math.abs(ca.y - cb.y) < 1;
      const k = colSeen.get(lay.layers.get(f.to)!) ?? 0; colSeen.set(lay.layers.get(f.to)!, k + 1);
      const xm = Bx.x - STUB - (k % 3) * 8, end = {x: Bx.x, y: cb.y};
      if (sameRow) pts = [{x: A.x + A.w, y: ca.y}, end];
      else if (gate) pts = [{x: ca.x, y: cb.y < ca.y ? A.y : A.y + A.h}, {x: ca.x, y: cb.y}, end];
      else pts = [{x: A.x + A.w, y: ca.y}, {x: xm, y: ca.y}, {x: xm, y: cb.y}, end];
      pts = simplify(pts);
      if (through(pts, [f.from, f.to])) { // something stands in the way: run along the lane's edge instead
        const up = cb.y <= ca.y, ch = up ? laneTop[lane(f.to)] + 8 : laneTop[lane(f.to)] + laneH[lane(f.to)] - 8;
        pts = simplify([{x: A.x + A.w, y: ca.y}, {x: A.x + A.w + STUB, y: ca.y}, {x: A.x + A.w + STUB, y: ch}, {x: Bx.x - STUB, y: ch}, {x: Bx.x - STUB, y: cb.y}, end]);
      }
    } else { // back (or into the same column): out of the bottom, along under the lane's content, into the bottom
      const yb = Math.max(A.y + A.h, Bx.y + Bx.h) + 14 + (fi % 3) * 7;
      pts = simplify([{x: ca.x, y: A.y + A.h}, {x: ca.x, y: yb}, {x: cb.x, y: yb}, {x: cb.x, y: Bx.y + Bx.h}]);
    }
    out.edges.push({from: f.from, to: f.to, line, points: pts});
    if (f.label) {
      const p0 = pts[0], p1 = pts[1], pn = pts[pts.length - 1];
      const horiz = p0.y === p1.y;
      // a condition belongs at the start of the flow, beside its first run
      const cands: Pt[] = horiz ? [{x: p0.x + 8 + (Math.abs(p1.x - p0.x) - 8) / 2, y: p0.y - 14}, {x: (p0.x + pn.x) / 2, y: p0.y - 14}, {x: p0.x + 8 + (Math.abs(p1.x - p0.x) - 8) / 2, y: p0.y + 14}]
        : [{x: p0.x + 40, y: p1.y > p0.y ? p0.y + 18 : p0.y - 18}, {x: p0.x - 40, y: p1.y > p0.y ? p0.y + 18 : p0.y - 18}, {x: p0.x + 30, y: (p0.y + p1.y) / 2}];
      addLabel(f.label, cands);
    }
  });
  return out;
}
