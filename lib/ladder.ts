// decisionLadder() placement (ADR 0083 D2): a fixed two-column figure for a chain of yes/no questions.
// Column 0: the questions stacked down, then the final box. Column 1: each question's "yes" answer on its row.
// "yes" runs right along the row, "no" runs straight down to the next question: every arrow is a 2 point line, so there is no layered layout and no routing.
// The states are q1 a1 q2 a2 ... qN aN otherwise and the arrows yes1 no1 yes2 no2 ... (what decisionLadder() writes).
import {textWidth} from './atoms.ts';
import {diamondLines} from './flow-nodes.ts';
import {fitFailure, isNoFit, type NoFit, widerThan} from './fit-width.ts';
import {measureNode, nodeRuns} from './tree.ts';
import type {NodeLines} from './tree.ts';
import {must} from './must.ts';
import {stepBadgeGeom, tooTall} from './layout-util.ts';
import type {Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {LaidOutStates, StatesBand} from './types/diagrams.ts';

const MIN_BOX = 80, STEP = 8, TAIL = 4;
const GAP_FLOOR = 20, LEAD_PAD = 12; // the least row gap, for a ladder without arrow words (with them the strip must hold the no chip: lh + 3); the space left of a numbered question's badge
const grid4 = (v: number): number => Math.ceil(v / 4) * 4;
type Col = {lines: NodeLines[]; w: number};

export function layoutLadder(band: StatesBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, probe = false): LaidOutStates | NoFit {
  const S = roles.note, sp = env.space ?? 1, n = (band.states.length - 1) / 2, cap = band.maxNodeW ?? 360, lh = S + 8; // lh: a chip's height
  const rows = Array.from({length: n}, (_, i) => i), qIds = [...rows.map(i => 2 * i), 2 * n], aIds = rows.map(i => 2 * i + 1);
  const state = (i: number) => must(band.states[i]);
  const chipW = (k: number): number => { const t = band.transitions[k]?.label; return t ? Math.ceil(textWidth(widthOf, t, S, 400)) + 12 : 0; };
  const yesW = Math.max(...rows.map(i => chipW(2 * i))), noW = Math.max(...rows.map(i => chipW(2 * i + 1)));
  // room for the yes chip above the arrow between the columns; the no chip (right of the middle of the question column) must not reach the answers
  const stub = Math.round(10 * sp), baseGap = Math.max(Math.round(48 * sp), yesW + 2 * stub + 14);
  const gapFor = (qW: number): number => Math.max(baseGap, noW ? Math.ceil(noW + 6 + stub - qW / 2) : 0);
  // The strip between two rows holds the no chip (at the top of it) and the next row's yes chip, which rises above that row's top when the row is short:
  // the strip is as tall as both, so the two chips never meet (a row of one line of text rises 7px).
  const rise = (i: number, rowH: number): number => i < n && chipW(2 * i) ? Math.max(0, lh + 3 - rowH / 2) : 0;
  // numbered: each question (not the final box) carries the step badge of box({step}) at its left; its text is wrapped in what is left of it
  const badge = stepBadgeGeom(roles), lead = band.numbered ? LEAD_PAD + 2 * badge.r : 0, numberedAt = (i: number): boolean => !!band.numbered && i % 2 === 0 && i < 2 * n;
  const measure = (i: number, max: number): NodeLines => {
    const s = state(i);
    if (s.shape === 'diamond') return diamondLines(s.label, s.sub, max, 0, widthOf, roles, env.wrap, env.keepWords);
    if (!numberedAt(i)) return measureNode(s.label, s.sub, max, widthOf, roles, env.wrap, env.keepWords);
    const l = measureNode(s.label, s.sub, Math.max(MIN_BOX - lead, max - lead), widthOf, roles, env.wrap, env.keepWords);
    return {...l, w: l.w + lead};
  };
  const column = (ids: number[], max: number): Col => { const lines = ids.map(i => measure(i, max)), wd = Math.max(...lines.map(l => l.w)); return {lines, w: Math.max(Math.ceil(wd), Math.min(grid4(wd), max))}; };
  const rowHs = (q: Col, a: Col): number[] => rows.map(i => grid4(Math.max(must(q.lines[i]).h, must(a.lines[i]).h)));
  const total = (q: Col, a: Col): number => rowHs(q, a).reduce((s, v) => s + v, 0) + must(q.lines[n]).h;
  const gaps = Math.max(0, n) * Math.round(32 * sp); // the row gaps (at least)
  // The question column's width is tried from the cap down on a fixed grid (so a wider figure only adds candidates), and the narrowest wrap last (when it does not fit, nothing does).
  // The answers take the widest wrap that fits beside it: a box may come out a few px wider than the width it was wrapped at, so narrower wraps are tried.
  const widths = [...Array.from({length: Math.ceil((cap - MIN_BOX) / STEP) + 1}, (_, k) => cap - k * STEP).filter(m => m >= MIN_BOX && m <= w - MIN_BOX - baseGap), MIN_BOX];
  const cands = widths.flatMap(m => {
    const q = column(qIds, m), gap = gapFor(q.w), room = w + 0.5 - q.w - gap;
    if (room < MIN_BOX) return [];
    // an answer may be as wide as the room: its second line (`sub`) stays on one line when it can (an explicit maxNodeW still caps it)
    for (let am = Math.min(band.maxNodeW ?? Infinity, Math.floor(room)); ; am -= STEP) {
      const a = column(aIds, Math.max(am, MIN_BOX));
      if (a.w <= room) return [{q, a, gap, h: total(q, a), ok: q.lines.every(l => l.label.length < 2 || [...must(l.label.at(-1))].length >= TAIL)}];
      if (am <= MIN_BOX) return [];
    }
  });
  // fewest lines (the shortest figure) first; of those a wrap with no stray last line; then the narrower column (ADR 0083 D2)
  const best = cands.reduce<(typeof cands)[number] | undefined>((b, c) => !b || (c.h !== b.h ? c.h < b.h : c.ok !== b.ok ? c.ok : c.q.w < b.q.w) ? c : b, undefined);
  if (!best) {
    const q = column(qIds, MIN_BOX), a = column(aIds, MIN_BOX), need = q.w + gapFor(q.w) + a.w;
    return {noFit: true, failure: () => fitFailure('decisionLadder()', w, [{label: `narrowest wrap (questions ${q.w}px, answers ${a.w}px)`, w: Math.ceil(need), h: total(q, a) + gaps}],
      // the band sits inside the diagram's 40px margins: the width to write is the one the figure needs plus them
      `widen the figure (diagram({width: ${widerThan([{label: '', w: need, h: 0}], 40)}})) or shorten the text`, ['the other direction (a ladder always has the questions down the left, the answers on their rows)'])};
  }
  const {q: qc, a: ac, gap} = best, heights = rowHs(qc, ac), diamond = state(0).shape === 'diamond';
  const x0 = x + Math.max(0, (w - qc.w - gap - ac.w) / 2), ax = x0 + qc.w + gap, cx = x0 + qc.w / 2;
  const out: LaidOutStates = {
    type: 'states', flavor: 'flowchart', arrange: 'ladder', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: 0,
    nodes: [], edges: [], texts: [], icons: [], labels: [], anchors: [], labelBoxes: [],
  };
  // box i of the states, laid out as `l` in rect r
  const place = (i: number, l: NodeLines, r: {x: number; y: number; w: number; h: number}) => {
    const s = state(i), textH = l.label.length * Math.round(roles.body * 1.4) + l.sub.length * Math.round(roles.note * 1.4), ind = numberedAt(i) ? lead : 0;
    out.nodes.push({...r, tone: s.tone ?? 'plain', ...(s.shape === 'diamond' ? {shape: 'diamond' as const} : {})});
    out.anchors.push({id: s.id, ...r});
    // a box as tall as its row holds its text in the middle (a box as tall as its text: no shift)
    out.texts.push(...nodeRuns({x: r.x + ind, y: s.shape === 'diamond' ? r.y + (r.h - textH) / 2 - 8 : r.y + (r.h - l.h) / 2, w: r.w - ind}, l, roles));
    if (ind) (out.badges ??= []).push({cx: r.x + LEAD_PAD + badge.r, cy: r.y + r.h / 2, r: badge.r, size: badge.size, label: String(i / 2 + 1)});
    out.labelBoxes.push({label: s.label, ...r});
    return r;
  };
  // arrow k (a 2 point line) and its chip, whose left edge is at `chipX(width)` and centre at height `cy`
  const arrow = (k: number, from: number, to: number, a: {x: number; y: number}, b: {x: number; y: number}, chipX: (cw: number) => number, cy: number): void => {
    const t = must(band.transitions[k]);
    out.edges.push({from: state(from).id, to: state(to).id, points: [a, b], line: t.line ?? 'solid', ...(t.tone ? {tone: t.tone} : {})});
    if (!t.label) return;
    const cw = chipW(k), box = {x: chipX(cw), y: cy - lh / 2, w: cw, h: lh};
    out.labels.push({text: t.label, ...box, tx: box.x + cw / 2, ty: box.y + S + 2, size: S, edge: out.edges.length - 1});
    out.labelBoxes.push({label: t.label, ...box});
  };
  // every row's rect first (the "no" arrow of a row ends at the next one)
  // The gap between two rows is 32 (scaled by the figure's spacing), and no less than the no chip and the next yes chip need. A figure taller than a 16:9 slide
  // allows (LADDER_SLIDE_ASPECT) packs the gaps toward GAP_FLOOR first: the slide then draws it larger, as its height is what holds it back.
  // The gap is one value for every row (even spacing). The no chip hangs right of the arrow in the question column and the next yes chip sits between the columns: when they
  // are side by side, the strip needs only the no chip's height; when they are not, the yes chip's rise above its row (a short row) is added, for the tallest of them.
  const noRight = qc.w / 2 + 6 + noW, yesLeft = qc.w + gap / 2 - yesW / 2, clear = noW === 0 || yesW === 0 || noRight + 2 <= yesLeft;
  const needed = (noW ? lh + Math.round(3 * sp) : 0) + (clear ? 0 : Math.max(0, ...heights.map((_h, i) => rise(i + 1, heights[i + 1] ?? 0))));
  const rowGap = (g: number): number => Math.max(g, needed);
  const stacked = (g: number): number => rise(0, must(heights[0])) + heights.reduce((t, rh) => t + rh + rowGap(g), 0) + must(qc.lines[n]).h;
  let rowG = Math.round(32 * sp);
  while (tooTall(stacked(rowG), w) && rowG > Math.round(GAP_FLOOR * sp)) rowG = Math.max(Math.round(GAP_FLOOR * sp), rowG - 2);
  const tops: number[] = [];
  let cy = y + rise(0, must(heights[0])); // the first yes chip rises above its row: the band starts above it
  for (const rh of heights) { tops.push(cy); cy += rh + rowGap(rowG); }
  // a question box is as tall as its row (as the answer is), so the gap between two boxes is the row gap in both columns, whatever an answer's second line adds; a diamond keeps its own height
  const qRect = (i: number) => {
    const l = must(qc.lines[i]), top = must(tops[i] ?? cy), rh = i < n ? must(heights[i]) : l.h, qw = diamond ? l.w : qc.w, h = diamond || i === n ? l.h : rh;
    return {x: x0 + (qc.w - qw) / 2, y: top + (rh - h) / 2, w: qw, h};
  };
  for (const i of rows) {
    const rh = must(heights[i]), top = must(tops[i]), mid = top + rh / 2, al = must(ac.lines[i]);
    const qr = place(2 * i, must(qc.lines[i]), qRect(i)), ar = place(2 * i + 1, al, {x: ax, y: top, w: ac.w, h: rh}), next = qRect(i + 1);
    arrow(2 * i, 2 * i, 2 * i + 1, {x: qr.x + qr.w, y: mid}, {x: ar.x, y: mid}, cw => (qr.x + qr.w + ar.x) / 2 - cw / 2, mid - lh / 2 - 3); // the yes chip: centred over the arrow, just above it
    arrow(2 * i + 1, 2 * i, 2 * i + 2, {x: cx, y: qr.y + qr.h}, {x: cx, y: next.y}, () => cx + 6, qr.y + qr.h + 2 + lh / 2); // the no chip: right of the arrow, at the top of it
  }
  place(2 * n, must(qc.lines[n]), qRect(n));
  out.h = qRect(n).y + must(qc.lines[n]).h - y;
  // The band width at which every answer's `sub` is on one line (the narrowest, in 8px steps): what the `ladder-height-bound` finding names. Only worked out for a figure too tall for a slide.
  if (!probe && tooTall(out.h, w) && band.states.some((s, i) => i % 2 === 1 && s.sub)) {
    const oneLine = (m: number): boolean => {
      const l = layoutLadder(band, x, y, m, widthOf, roles, env, true);
      if (isNoFit(l)) return false;
      return aIds.every(k => { const r = must(l.anchors[k]); return l.texts.filter(t => t.muted && t.x > r.x && t.x < r.x + r.w && t.y > r.y && t.y < r.y + r.h).length <= 1; });
    };
    for (let m = 320; m <= 900; m += 8) if (oneLine(m)) { out.oneLineW = m; break; }
  }
  return out;
}
