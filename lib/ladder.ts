// SPIKE (ADR decision ladder): a fixed two-column placement for a chain of yes/no questions.
// Column 0: the questions stacked down, then the final box; column 1: each question's "yes" answer on its row.
// "yes" runs right on the row, "no" runs straight down to the next question. No layered layout, no routing.
import {textWidth} from './atoms.ts';
import {diamondLines} from './flow-nodes.ts';
import {measureNode, nodeRuns} from './tree.ts';
import type {NodeLines} from './tree.ts';
import type {Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {LaidOutStates, StatesBand} from './types/diagrams.ts';
import {must} from './must.ts';

const CHIP_PAD = 6, ARROW = 14, STUB = 10;
const grid4 = (v: number): number => Math.ceil(v / 4) * 4;

export function layoutLadder(band: StatesBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutStates {
  const S = roles.note;
  const n = Math.floor(band.states.length / 2); // q1 a1 q2 a2 ... qn an end
  const qs = Array.from({length: n}, (_, i) => must(band.states[2 * i])), as = Array.from({length: n}, (_, i) => must(band.states[2 * i + 1]));
  const end = must(band.states[2 * n]);
  const yesT = band.transitions.find(t => t.from === qs[0]?.id && t.to === as[0]?.id)?.label ?? '';
  const labelW = (t: string): number => t ? Math.ceil(textWidth(widthOf, t, S, 400)) + 2 * CHIP_PAD : 0;
  const lh = S + 8;
  const yesW = Math.max(...band.transitions.filter(t => qs.some(q => q.id === t.from) && as.some(a => a.id === t.to)).map(t => labelW(t.label ?? '')), labelW(yesT));
  const hGap = Math.max(48, yesW + 2 * STUB + ARROW); // room for the yes chip above the arrow
  const vGap = Math.max(32, lh + 10); // room for the no chip beside the arrow
  const diamond = qs.some(q => q.shape === 'diamond');
  // the question column takes ~55% of what is left after the gap; the answer column the rest
  const qMax = Math.min(band.maxNodeW ?? 360, Math.floor((w - hGap) * 0.55)), aMax = Math.min(band.maxNodeW ?? 360, w - hGap - qMax);
  const measure = (s: StatesBand['states'][number], max: number): NodeLines => s.shape === 'diamond'
    ? diamondLines(s.label, s.sub, max, 0, widthOf, roles, env.wrap, env.keepWords ?? false)
    : measureNode(s.label, s.sub, max, widthOf, roles, env.wrap, env.keepWords ?? false);
  const ql = qs.map(q => measure(q, qMax)), al = as.map(a => measure(a, aMax)), el = measure(end, qMax);
  const qW = grid4(Math.max(...ql.map(l => l.w), el.w)), aW = grid4(Math.max(...al.map(l => l.w)));
  const total = qW + hGap + aW, x0 = x + Math.max(0, (w - total) / 2), ax = x0 + qW + hGap;
  const out: LaidOutStates = {
    type: 'states', flavor: 'flowchart', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: 0,
    nodes: [], edges: [], texts: [], icons: [], labels: [], anchors: [], labelBoxes: [],
  };
  const place = (s: StatesBand['states'][number], l: NodeLines, r: {x: number; y: number; w: number; h: number}): void => {
    out.nodes.push({...r, tone: s.tone ?? 'plain', ...(s.shape === 'diamond' || s.shape === 'pill' ? {shape: s.shape} : {})});
    out.anchors.push({id: s.id, ...r});
    const textH = l.label.length * Math.round(roles.body * 1.4) + l.sub.length * Math.round(roles.note * 1.4);
    const y0 = s.shape === 'diamond' ? r.y + (r.h - textH) / 2 - 8 : r.y + (r.h - l.h) / 2;
    out.texts.push(...nodeRuns({x: r.x, y: y0, w: r.w}, l, roles));
    out.labelBoxes.push({label: s.label, ...r});
  };
  const chip = (text: string, edge: number, cx: number, cy: number): void => {
    if (!text) return;
    const lw = labelW(text), b = {x: cx - lw / 2, y: cy - lh / 2, w: lw, h: lh};
    out.labels.push({text, ...b, tx: cx, ty: b.y + S + 2, size: S, edge});
    out.labelBoxes.push({label: text, ...b});
  };
  let cy = y;
  const qRects: {x: number; y: number; w: number; h: number}[] = [];
  for (let i = 0; i < n; i++) {
    const q = must(qs[i]), a = must(as[i]), qlI = must(ql[i]), alI = must(al[i]);
    const rowH = grid4(Math.max(qlI.h, alI.h));
    const qr = {x: x0 + (diamond ? (qW - qlI.w) / 2 : 0), y: cy + (rowH - qlI.h) / 2, w: diamond ? qlI.w : qW, h: qlI.h};
    const ar = {x: ax, y: cy + (rowH - alI.h) / 2, w: aW, h: alI.h};
    place(q, qlI, qr); place(a, alI, ar); qRects.push(qr);
    const mid = cy + rowH / 2;
    const yes = band.transitions.find(t => t.from === q.id && t.to === a.id);
    out.edges.push({from: q.id, to: a.id, points: [{x: qr.x + qr.w, y: mid}, {x: ar.x, y: mid}], line: yes?.line ?? 'solid', ...(yes?.tone ? {tone: yes.tone} : {})});
    chip(yes?.label ?? '', out.edges.length - 1, (qr.x + qr.w + ar.x) / 2, mid - lh / 2 - 3);
    cy += rowH + vGap;
  }
  const er = {x: x0 + (qW - el.w) / 2, y: cy, w: el.w, h: el.h};
  // the final box is as wide as the question column when the questions are boxes (one straight column)
  const erFull = diamond ? er : {...er, x: x0, w: qW};
  place(end, el, erFull);
  // the "no" arrows: straight down the middle of the question column
  const cx = x0 + qW / 2;
  for (let i = 0; i < n; i++) {
    const q = must(qs[i]), r = must(qRects[i]), next = i + 1 < n ? must(qRects[i + 1]) : erFull, to = i + 1 < n ? must(qs[i + 1]).id : end.id;
    const no = band.transitions.find(t => t.from === q.id && t.to === to);
    out.edges.push({from: q.id, to, points: [{x: cx, y: r.y + r.h}, {x: cx, y: next.y}], line: no?.line ?? 'solid', ...(no?.tone ? {tone: no.tone} : {})});
    chip(no?.label ?? '', out.edges.length - 1, cx + 6 + labelW(no?.label ?? '') / 2, (r.y + r.h + next.y) / 2);
  }
  out.h = cy + el.h - y;
  return out;
}
