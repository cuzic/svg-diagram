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
/** A column's width: the widest line on the 4px grid, but never past `cap` (the grid must not push a box over maxNodeW) unless the text itself is wider. */
const colW = (widest: number, cap: number): number => Math.max(Math.ceil(widest), Math.min(grid4(widest), cap));
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
  // The strip between two rows holds the no chip (at the top of it) and the next row's yes chip, which rises above that row's top when the row is short:
  // the strip is as tall as both, so the two chips never meet (a row of one line of text rises 7px).
  const pad = Math.max(2, Math.round(3 * space)), minGap = Math.round(32 * space);
  const rise = (i: number, rowH: number): number => i < n && yesT[i]?.label ? Math.max(0, lh + 3 - rowH / 2) : 0;
  const cap = band.maxNodeW ?? DEFAULT_MAX;
  const diamond = qs.some(q => q.shape === 'diamond');
  const measure = (s: StateItem, max: number): NodeLines => s.shape === 'diamond' ? diamondLines(s.label, s.sub, max, 0, widthOf, roles, env.wrap, floor) : measureNode(s.label, s.sub, max, widthOf, roles, env.wrap, floor);
  const qItems = [...qs, end];
  const qColumn = (max: number): QColumn => {
    const lines = qItems.map(s => measure(s, max)), cw = colW(Math.max(...lines.map(l => l.w)), max);
    // the last line of a wrapped question is never a stray 1-3 characters
    const tailOk = lines.every(l => l.label.length < 2 || [...must(l.label.at(-1))].length >= TAIL);
    return {lines, w: cw, gap: gapFor(cw), tailOk};
  };
  const aColumn = (max: number): {lines: NodeLines[]; w: number} => { const lines = as.map(s => measure(s, max)); return {lines, w: colW(Math.max(...lines.map(l => l.w)), max)}; };
  /** The widest wrap of the answers (from `max` down) that fits in `room`: a box may come out a few px wider than the width it was wrapped at, so the next narrower wrap is tried. */
  const answersIn = (max: number, room: number): {lines: NodeLines[]; w: number} | undefined => {
    for (let m = Math.floor(max); m >= MIN_BOX; m -= STEP) { const a = aColumn(m); if (a.w <= room) return a; }
    const a = aColumn(MIN_BOX);
    return a.w <= room ? a : undefined;
  };
  const rowHs = (q: QColumn, a: {lines: NodeLines[]}): number[] => qs.map((_, i) => grid4(Math.max(must(q.lines[i]).h, must(a.lines[i]).h)));
    type Cand = {q: QColumn; a: {lines: NodeLines[]; w: number}; h: number};
  const cands: Cand[] = [];
  // widths from the cap down on a fixed grid (so a wider figure only adds candidates), and the narrowest wrap last: when it does not fit, nothing does
  const widths: number[] = [];
  for (let m = cap; m >= MIN_BOX; m -= STEP) if (m <= Math.floor(w) - MIN_BOX - baseGap) widths.push(m);
  if (!widths.includes(MIN_BOX)) widths.push(MIN_BOX);
  for (const m of widths) {
    const q = qColumn(m), room = w + 0.5 - q.w - q.gap;
    if (room < MIN_BOX) continue;
    const a = answersIn(Math.min(cap, Math.floor(room)), room);
    if (!a) continue;
    cands.push({q, a, h: rowHs(q, a).reduce((sum, v) => sum + v, 0) + must(q.lines[n]).h});
  }
  // fewest lines (the shortest figure) first; of those a wrap with no stray last line; then the narrower column (ADR 0083 D2)
  const best = cands.reduce<Cand | undefined>((b, c) => !b || (c.h !== b.h ? c.h < b.h : c.q.tailOk !== b.q.tailOk ? c.q.tailOk : c.q.w < b.q.w) ? c : b, undefined);
  if (!best) {
    const q = qColumn(MIN_BOX), a = aColumn(MIN_BOX), need = q.w + q.gap + a.w;
    // the band sits inside the diagram's 40px margins: the width to write is the one the figure needs plus them
    return {noFit: true, failure: () => fitFailure('decisionLadder()', w, [{label: `two columns at the narrowest wrap (questions ${q.w}px, answers ${a.w}px)`, w: Math.ceil(need), h: rowHs(q, a).reduce((sum, v) => sum + v, 0)}],
      `widen the figure (diagram({width: ${widerThan([{label: '', w: need, h: 0}], 40)}})), or shorten the text of the questions and answers`, ['the other direction (a ladder always has the questions down the left, the answers on their rows)'])};
  }
  const {q: qc, a: ac} = best, heights = rowHs(qc, ac), hGap = qc.gap;
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
  let cy = y + rise(0, must(heights[0])); // the first yes chip rises above its row: the band starts above it
  for (const [i, rh] of heights.entries()) { rowTop.push(cy); cy += rh + Math.max(minGap, lh + pad + rise(i + 1, heights[i + 1] ?? 0)); }
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
    // the no chip: right of the arrow, at the top of it (the next row's yes chip rises into the lower part of the strip)
    arrowOut(noT[i], q.id, nextId, [{x: cx, y: qr.y + qr.h}, {x: cx, y: next.y}], () => ({x: cx + noPad, y: qr.y + qr.h + 2 + lh / 2}));
  }
  place(end, must(qc.lines[n]), qRect(n));
  out.h = qRect(n).y + must(qc.lines[n]).h - y;
  return out;
}
