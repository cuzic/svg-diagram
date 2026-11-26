// decisionLadder() placement (ADR 0083 D2): a fixed two-column figure for a chain of yes/no questions.
// Column 0: the questions stacked down, then the final box. Column 1: each question's "yes" answer on its row.
// "yes" runs right along the row, "no" runs straight down to the next question: every arrow is a 2 point line, so there is no layered layout and no routing.
import {textWidth} from './atoms.ts';
import {diamondLines} from './flow-nodes.ts';
import {fitFailure, type NoFit, widerThan} from './fit-width.ts';
import {measureNode, nodeRuns} from './tree.ts';
import type {NodeLines} from './tree.ts';
import {must} from './must.ts';
import type {Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {LaidOutStates, StateItem, StatesBand, Transition} from './types/diagrams.ts';

const CHIP_PAD = 6, ARROW = 14, STUB = 10, MIN_BOX = 80, STEP = 8, TAIL = 4, DEFAULT_MAX = 360;
const grid4 = (v: number): number => Math.ceil(v / 4) * 4;
type R = {x: number; y: number; w: number; h: number};

/** One candidate wrap of the question column: the lines of each question (and of the final box), the column width, and what that costs. */
interface QColumn {lines: NodeLines[]; w: number; gap: number; tailOk: boolean}

export function layoutLadder(band: StatesBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutStates | NoFit {
  const S = roles.note, space = env.space ?? 1, floor = env.keepWords ?? false;
  // the states are q1 a1 q2 a2 ... qN aN otherwise (what decisionLadder() writes)
  const n = (band.states.length - 1) / 2;
  const qs = Array.from({length: n}, (_, i) => must(band.states[2 * i])), as = Array.from({length: n}, (_, i) => must(band.states[2 * i + 1]));
  const end = must(band.states[2 * n]);
  const arrow = (from: string, to: string): Transition | undefined => band.transitions.find(t => t.from === from && t.to === to);
  const yesT = qs.map((q, i) => arrow(q.id, must(as[i]).id)), noT = qs.map((q, i) => arrow(q.id, i + 1 < n ? must(qs[i + 1]).id : end.id));
  const chipW = (t: string | undefined): number => t ? Math.ceil(textWidth(widthOf, t, S, 400)) + 2 * CHIP_PAD : 0;
  const lh = S + 8; // a chip's height
  const yesW = Math.max(0, ...yesT.map(t => chipW(t?.label))), noW = Math.max(0, ...noT.map(t => chipW(t?.label)));
  // room for the yes chip above the arrow between the columns; the no chip beside its arrow must not reach the answers (it sits right of the middle of the question column)
  const stub = Math.round(STUB * space), noPad = 6;
  const baseGap = Math.max(Math.round(48 * space), yesW + 2 * stub + ARROW);
  const gapFor = (qW: number): number => Math.max(baseGap, noW ? Math.ceil(noW + noPad + stub - qW / 2) : 0);
  const vGap = Math.max(Math.round(32 * space), lh + Math.round(10 * space)); // room for the no chip beside the arrow
  const cap = band.maxNodeW ?? DEFAULT_MAX;
  const diamond = qs.some(q => q.shape === 'diamond');
  const measure = (s: StateItem, max: number): NodeLines => s.shape === 'diamond' ? diamondLines(s.label, s.sub, max, 0, widthOf, roles, env.wrap, floor) : measureNode(s.label, s.sub, max, widthOf, roles, env.wrap, floor);
  const qItems = [...qs, end];
  const qColumn = (max: number): QColumn => {
    const lines = qItems.map(s => measure(s, max)), cw = grid4(Math.max(...lines.map(l => l.w)));
    // the last line of a wrapped question is never a stray 1-3 characters
    const tailOk = lines.every(l => l.label.length < 2 || [...must(l.label.at(-1))].length >= TAIL);
    return {lines, w: cw, gap: gapFor(cw), tailOk};
  };
  const aColumn = (max: number): {lines: NodeLines[]; w: number} => { const lines = as.map(s => measure(s, max)); return {lines, w: grid4(Math.max(...lines.map(l => l.w)))}; };
  const rowHs = (q: QColumn, a: {lines: NodeLines[]}): number[] => qs.map((_, i) => grid4(Math.max(must(q.lines[i]).h, must(a.lines[i]).h)));
  // D2: the question column's width is tried in 8px steps; of the ones the answers still fit beside, the shortest figure wins, among them a wrap that leaves no stray last line, then the narrower column
  type Cand = {q: QColumn; a: {lines: NodeLines[]; w: number}; h: number};
  const cands: Cand[] = [];
  for (let m = Math.min(cap, Math.floor(w) - MIN_BOX - baseGap); m >= MIN_BOX; m -= STEP) {
    const q = qColumn(m), room = w + 0.5 - q.w - q.gap;
    if (room < MIN_BOX) continue;
    const a = aColumn(Math.min(cap, Math.floor(room)));
    if (a.w > room) continue;
    cands.push({q, a, h: rowHs(q, a).reduce((s, v) => s + v, 0) + must(q.lines[n]).h});
  }
  const best = cands.reduce<Cand | undefined>((b, c) => !b || (c.q.tailOk !== b.q.tailOk ? c.q.tailOk : c.h !== b.h ? c.h < b.h : c.q.w < b.q.w) ? c : b, undefined);
  if (!best) {
    const q = qColumn(MIN_BOX), a = aColumn(MIN_BOX), need = q.w + q.gap + a.w;
    return {noFit: true, failure: () => fitFailure('decisionLadder()', w, [{label: `two columns at the narrowest wrap (questions ${q.w}px, answers ${a.w}px)`, w: need, h: rowHs(q, a).reduce((s, v) => s + v, 0)}],
      `widen the figure (diagram({width: ${widerThan([{label: '', w: need, h: 0}])}})), or shorten the text of the questions and answers`, ['the other direction (a ladder always has the questions down the left, the answers on their rows)'])};
  }
  const {q: qc, a: ac} = best, heights = rowHs(qc, ac), hGap = qc.gap, vgap = vGap;
  const total = qc.w + hGap + ac.w, x0 = x + Math.max(0, (w - total) / 2), ax = x0 + qc.w + hGap, cx = x0 + qc.w / 2;
  const out: LaidOutStates = {
    type: 'states', flavor: 'flowchart', arrange: 'ladder', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: 0,
    nodes: [], edges: [], texts: [], icons: [], labels: [], anchors: [], labelBoxes: [],
  };
  const place = (s: StateItem, l: NodeLines, r: R): R => {
    out.nodes.push({...r, tone: s.tone ?? 'plain', ...(s.shape === 'diamond' ? {shape: 'diamond' as const} : {})});
    out.anchors.push({id: s.id, ...r});
    const textH = l.label.length * Math.round(roles.body * 1.4) + l.sub.length * Math.round(roles.note * 1.4);
    out.texts.push(...nodeRuns({x: r.x, y: s.shape === 'diamond' ? r.y + (r.h - textH) / 2 - 8 : r.y, w: r.w}, l, roles));
    out.labelBoxes.push({label: s.label, ...r});
    return r;
  };
  const arrowOut = (t: Transition | undefined, from: string, to: string, points: {x: number; y: number}[], chipAt: (w: number) => {x: number; y: number}): void => {
    out.edges.push({from, to, points, line: t?.line ?? 'solid', ...(t?.tone ? {tone: t.tone} : {})});
    if (!t?.label) return;
    const cw = chipW(t.label), c = chipAt(cw), b = {x: c.x, y: c.y - lh / 2, w: cw, h: lh};
    out.labels.push({text: t.label, ...b, tx: c.x + cw / 2, ty: b.y + S + 2, size: S, edge: out.edges.length - 1});
    out.labelBoxes.push({label: t.label, ...b});
  };
  // every row's rects first (the "no" arrow of a row ends at the next one), then the boxes and arrows in the order of the states
  const rowTop: number[] = [];
  let cy = y;
  for (const rh of heights) { rowTop.push(cy); cy += rh + vgap; }
  const qRect = (i: number): R => {
    const l = must(qc.lines[i]), top = i < n ? must(rowTop[i]) : cy, rh = i < n ? must(heights[i]) : l.h;
    return diamond ? {x: x0 + (qc.w - l.w) / 2, y: top + (rh - l.h) / 2, w: l.w, h: l.h} : {x: x0, y: top + (rh - l.h) / 2, w: qc.w, h: l.h};
  };
  for (let i = 0; i < n; i++) {
    const q = must(qs[i]), a = must(as[i]), rh = must(heights[i]), top = must(rowTop[i]), mid = top + rh / 2;
    const qr = place(q, must(qc.lines[i]), qRect(i));
    const al = must(ac.lines[i]), ar = place(a, al, {x: ax, y: top + (rh - al.h) / 2, w: ac.w, h: al.h});
    // the yes chip: centred over the arrow, just above it
    arrowOut(yesT[i], q.id, a.id, [{x: qr.x + qr.w, y: mid}, {x: ar.x, y: mid}], cw => ({x: (qr.x + qr.w + ar.x) / 2 - cw / 2, y: mid - lh / 2 - 3}));
    const next = qRect(i + 1), nextId = i + 1 < n ? must(qs[i + 1]).id : end.id;
    // the no chip: right of the arrow, halfway down it
    arrowOut(noT[i], q.id, nextId, [{x: cx, y: qr.y + qr.h}, {x: cx, y: next.y}], () => ({x: cx + noPad, y: (qr.y + qr.h + next.y) / 2}));
  }
  place(end, must(qc.lines[n]), qRect(n));
  out.h = qRect(n).y + must(qc.lines[n]).h - y;
  return out;
}
