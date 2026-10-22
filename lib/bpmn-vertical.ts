// bpmn({dir: 'v'}): the same business flow with the lanes as columns and the flow running down (ADR 0042). A node's row is its layer
// along the flow; its column is its lane. A flow is routed by trying many orthogonal paths (out of the bottom or a side, into the top or
// a side, along a channel between the rows) and taking the shortest that touches no node or text and runs on no other flow.
import {textWidth} from './atoms.ts';
import {layoutLayered} from './graph-layout.ts';
import type {Pt} from './graph-layout.ts';
import {checkBpmnInput, isGate, lineH, measureBpmnNodes} from './bpmn.ts';
import type {BpmnMeasure} from './bpmn.ts';
import {must} from './must.ts';
import {nodeRuns} from './tree.ts';
import {wrapText} from './wrap.ts';
import type {Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {BpmnBand, LaidOutBpmn} from './types/diagrams.ts';

const COL_MAX = 240, TASK_MAX = 168, TASK_MIN = 80, HEAD_PAD = 10, TOP_PAD = 26, ROW_GAP = 44, CHIP_PAD = 5, ICON_H = 24, TASK_ICON = 20, EDGE = 6;

interface Box {x: number; y: number; w: number; h: number}
interface Seg {x1: number; x2: number; y1: number; y2: number}
interface Obstacle extends Box {node: string; text: boolean}
interface Candidate {pts: Pt[]; pen: number}

const segsOf = (pts: Pt[]): Seg[] => pts.slice(1).map((q, i) => { const a = must(pts[i]); return {x1: Math.min(a.x, q.x), x2: Math.max(a.x, q.x), y1: Math.min(a.y, q.y), y2: Math.max(a.y, q.y)}; }).filter(g => g.x2 - g.x1 > 0.01 || g.y2 - g.y1 > 0.01);
const hits = (g: Seg, r: Box, pad: number): boolean => g.x1 <= r.x + r.w + pad && g.x2 >= r.x - pad && g.y1 <= r.y + r.h + pad && g.y2 >= r.y - pad;
const isVert = (g: Seg): boolean => g.x2 - g.x1 < 0.01;
const isHoriz = (g: Seg): boolean => g.y2 - g.y1 < 0.01;
/** Two runs of the same direction closer than 5px that share a stretch, or end less than 8px apart on the same line (they would look like one line). */
const sameRun = (a: Seg, b: Seg): boolean => (isVert(a) && isVert(b) && Math.abs(a.x1 - b.x1) < 5 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > -8) || (isHoriz(a) && isHoriz(b) && Math.abs(a.y1 - b.y1) < 5 && Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > -8);
const cross = (a: Seg, b: Seg): boolean => {
  const [v, h] = isVert(a) && isHoriz(b) ? [a, b] : isHoriz(a) && isVert(b) ? [b, a] : [undefined, undefined];
  return v !== undefined && h !== undefined && h.y1 > v.y1 - 1 && h.y1 < v.y2 + 1 && v.x1 > h.x1 - 1 && v.x1 < h.x2 + 1;
};
const simplify = (pts: Pt[]): Pt[] => {
  const o: Pt[] = [];
  for (const q of pts) { const a = o[o.length - 1]; if (!a || Math.abs(a.x - q.x) > 0.01 || Math.abs(a.y - q.y) > 0.01) o.push(q); }
  return o.filter((q, i) => i === 0 || i === o.length - 1 || !((must(o[i - 1]).x === q.x && q.x === must(o[i + 1]).x) || (must(o[i - 1]).y === q.y && q.y === must(o[i + 1]).y)));
};
const overlap = (a: Box, b: Box, pad = 0): boolean => a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;

export function layoutBpmnVertical(band: BpmnBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutBpmn {
  const B = roles.body, S = roles.note, space = env.space ?? 1;
  const {laneIdx, kindOf} = checkBpmnInput(band);
  const L = band.lanes.length, colW = Math.min(COL_MAX, Math.floor(w / L / 4) * 4), taskMax = Math.min(TASK_MAX, colW - 28); // colW: a multiple of 4, the lane borders are drawn on a 4px grid
  if (taskMax < TASK_MIN) throw new Error(`bpmn({dir: 'v'}): ${L} lanes leave each column ${colW}px wide, too narrow for a task (use fewer lanes, or dir: 'h')`);
  const meas = measureBpmnNodes(band, kindOf, taskMax, widthOf, roles, env);
  // a start / end event or gateway names itself beside its shape; the room is what the column has to the right
  const sideLabel = new Map<string, string[]>();
  for (const n of band.nodes) {
    const k = must(kindOf.get(n.id)), m = must(meas.get(n.id));
    if (k === 'task' || !n.label) continue;
    const room = Math.max(48, Math.floor(colW / 2 - m.w / 2 - 10));
    sideLabel.set(n.id, wrapText(n.label, {maxWidth: room, atomWidth: a => widthOf(a, B, 400, 'sans'), mode: env.wrap}));
  }
  const laneLines = band.lanes.map(l => wrapText(l.label, {maxWidth: colW - 16, atomWidth: a => widthOf(a, B, 700, 'sans'), mode: env.wrap}));
  const headH = Math.max(...laneLines.map(ls => ls.length)) * lineH(B) + 2 * HEAD_PAD;

  // rows: the layer of each node along the flow; a lane's nodes that share a row are stacked
  const lay = layoutLayered(
    band.nodes.map(n => ({id: n.id, size: {w: must(meas.get(n.id)).w, h: must(meas.get(n.id)).h}})),
    band.flows.map(f => ({from: f.from, to: f.to})),
    {start: band.nodes.filter(n => kindOf.get(n.id) === 'start').map(n => n.id), tighten: false},
  );
  const nRows = Math.max(...lay.layers.values()) + 1;
  const stacks = new Map<string, string[]>();
  for (const n of band.nodes) { const k = `${laneIdx.get(n.lane)}:${lay.layers.get(n.id)}`; stacks.set(k, [...(stacks.get(k) ?? []), n.id]); }
  const heightOf = (m: BpmnMeasure, id: string): number => Math.max(m.h, (sideLabel.get(id)?.length ?? 0) * lineH(B) + 4);
  const gap = Math.round(ROW_GAP * space), rowH = Array.from({length: nRows}, () => 0);
  for (const [k, list] of stacks) {
    const r = Number(k.split(':')[1]);
    rowH[r] = Math.max(must(rowH[r]), list.reduce((s, id, i) => s + heightOf(must(meas.get(id)), id) + (i ? 12 : 0), 0));
  }
  const rowTop: number[] = [];
  rowH.reduce((a, h, i) => (rowTop[i] = a, a + h + gap), y + headH + TOP_PAD);
  const bottom = must(rowTop[nRows - 1]) + must(rowH[nRows - 1]) + TOP_PAD;
  const width = colW * L, x0 = x + Math.floor((w - width) / 8) * 4, height = bottom - y;

  const out: LaidOutBpmn = {
    type: 'bpmn', dir: 'v', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x: x0, y, w: width, h: height,
    lanes: [], nodes: [], icons: [], edges: [], texts: [], labels: [], anchors: [], labelBoxes: [],
  };
  band.lanes.forEach((l, i) => {
    out.lanes.push({x: x0 + colW * i, y, w: colW, h: height, labelW: 0, labelH: headH, tone: l.tone ?? 'plain'});
    const ls = must(laneLines[i]), top = y + headH / 2 - (ls.length * lineH(B)) / 2;
    ls.forEach((ln, k) => out.texts.push({text: ln, x: x0 + colW * i + colW / 2, y: top + k * lineH(B) + B, size: B, bold: true, muted: false, anchor: 'middle'}));
  });

  // place nodes: lane centre, row top (stacked in the row, centred on the row's tallest)
  const rect = new Map<string, Box>();
  for (const [k, list] of stacks) {
    const li = Number(k.split(':')[0]), r = Number(k.split(':')[1]), cx = x0 + colW * li + colW / 2;
    let ty = must(rowTop[r]);
    for (const id of list) { const m = must(meas.get(id)), hh = heightOf(m, id); rect.set(id, {x: cx - m.w / 2, y: ty + (hh - m.h) / 2, w: m.w, h: m.h}); ty += hh + 12; }
  }
  const obstacles: Obstacle[] = [];
  const sideBox = new Map<string, Box>();
  for (const n of band.nodes) {
    const r = must(rect.get(n.id)), m = must(meas.get(n.id)), k = must(kindOf.get(n.id));
    out.nodes.push({...r, kind: k, tone: n.tone ?? 'plain'});
    out.anchors.push({id: n.id, ...r});
    const nb = {label: n.label ?? n.id, ...r};
    out.labelBoxes.push(nb);
    obstacles.push({...r, node: n.id, text: false});
    const iconH = n.icon ? ICON_H : 0;
    if (n.icon) out.icons.push({node: out.nodes.length - 1, name: n.icon, glyph: must(n.iconGlyph), x: r.x + (r.w - TASK_ICON) / 2, y: r.y + 8, size: TASK_ICON, ...(n.iconTone ? {tone: n.iconTone} : {})});
    if (m.lines) { out.texts.push(...nodeRuns({...r, y: r.y + iconH}, m.lines, roles).map(t => ({...t, anchor: 'middle' as const}))); continue; }
    const lines = sideLabel.get(n.id);
    if (!lines) continue;
    const gate = isGate(k), lx = r.x + r.w + 6, cy = r.y + r.h / 2, tw = Math.max(...lines.map(l => Math.ceil(textWidth(widthOf, l, B, 400))));
    // a gateway's name sits above the line through its side vertices (so a flow can leave sideways beneath it); an event's is centred on its shape
    const first = gate ? cy - 8 - (lines.length - 1) * lineH(B) : cy + B / 2 - 2 - ((lines.length - 1) * lineH(B)) / 2;
    lines.forEach((ln, i) => {
      const ty = first + i * lineH(B), w2 = Math.ceil(textWidth(widthOf, ln, B, 400));
      out.texts.push({text: ln, x: lx, y: ty, size: B, bold: false, muted: false, anchor: 'start'});
      out.labelBoxes.push({label: ln, x: lx, y: ty - B, w: w2, h: B + 4});
    });
    const box = {x: lx - 2, y: first - B - 2, w: tw + 4, h: (lines.length - 1) * lineH(B) + B + 6}; // from above the first line to just under the last baseline
    sideBox.set(n.id, box);
    obstacles.push({...box, node: n.id, text: true});
  }

  // flows
  const half = (id: string): number => must(rect.get(id)).w / 2;
  const colX = (id: string): number => must(rect.get(id)).x + half(id);
  const placed: Seg[] = [];
  const candidates = (fid: string, tid: string): Candidate[] => {
    const s = must(rect.get(fid)), t = must(rect.get(tid)), scx = colX(fid), tcx = colX(tid), scy = s.y + s.h / 2, tcy = t.y + t.h / 2, c: Candidate[] = [];
    if (t.y <= s.y) { // back: out of a side or the top / bottom, round the outside of the column, into a side
      for (const sd of [1, -1]) for (const td of [1, -1]) {
        const S = {x: scx + sd * half(fid), y: scy}, T = {x: tcx + td * half(tid), y: tcy}, pen = (sd < 0 ? 10 : 0) + (td < 0 ? 10 : 0) + (sd === td ? 0 : 30);
        if (sd === td) {
          for (let k = 0; k < 16; k++) {
            const xr = sd > 0 ? Math.max(S.x, T.x) + 9 + k * 7 : Math.min(S.x, T.x) - 9 - k * 7;
            if (xr >= x0 + EDGE && xr <= x0 + width - EDGE) c.push({pts: [S, {x: xr, y: S.y}, {x: xr, y: T.y}, T], pen: pen + (onEdge(xr) ? 40 : 0)});
          }
        } else {
          for (let k = 0; k < 4; k++) for (const gy of [s.y + s.h + 17 + k * 7, s.y - 17 - k * 7, t.y + t.h + 17 + k * 7, t.y - 17 - k * 7]) {
            const xs = S.x + sd * 14, xt = T.x + td * 14;
            if (xs >= x0 + EDGE && xs <= x0 + width - EDGE && xt >= x0 + EDGE && xt <= x0 + width - EDGE) c.push({pts: [S, {x: xs, y: S.y}, {x: xs, y: gy}, {x: xt, y: gy}, {x: xt, y: T.y}, T], pen});
          }
        }
      }
      for (const [ey, g] of [[s.y, -1], [s.y + s.h, 1]] as const) for (const td of [1, -1]) for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 16; kx++) {
        const T = {x: tcx + td * half(tid), y: tcy}, gy = ey + g * (17 + ky * 7), xr = T.x + td * (12 + kx * 7);
        if (xr >= x0 + EDGE && xr <= x0 + width - EDGE) c.push({pts: [{x: scx, y: ey}, {x: scx, y: gy}, {x: xr, y: gy}, {x: xr, y: T.y}, T], pen: 40 + (td < 0 ? 10 : 0)});
      }
      return c;
    }
    const gys = [t.y - 17, s.y + s.h + 17, tcy];
    for (let k = 1; k < 6; k++) gys.push(t.y - 17 - k * 7, s.y + s.h + 17 + k * 7);
    const dx = Math.sign(tcx - scx); // a side is the natural one when it faces the other end; entering from the top is the rule
    const exits = [{x: scx, y: s.y + s.h, d: 0, pen: 0}, ...[1, -1].map(d => ({x: scx + d * half(fid), y: scy, d, pen: dx === d ? 25 : dx === 0 ? 40 : 80}))];
    const entries = [{x: tcx, y: t.y, d: 0, pen: 0}, ...[-1, 1].map(d => ({x: tcx + d * half(tid), y: tcy, d, pen: d === -dx ? 60 : 120}))];
    for (const ex of exits) for (const en of entries) for (const gy of gys) for (const m of [14, 22, 30]) {
      if (gy < ex.y + 6 || gy > (en.d ? en.y : en.y - 12)) continue;
      const colx = ex.d ? ex.x + ex.d * m : ex.x, pts: Pt[] = [{x: ex.x, y: ex.y}];
      if (ex.d) pts.push({x: colx, y: ex.y});
      pts.push({x: colx, y: gy});
      if (en.d) { const xi = en.x + en.d * m; pts.push({x: xi, y: gy}, {x: xi, y: en.y}, {x: en.x, y: en.y}); } else pts.push({x: en.x, y: gy}, {x: en.x, y: en.y});
      c.push({pts, pen: ex.pen + en.pen});
    }
    return c;
  };
  const onEdge = (px: number): boolean => band.lanes.some((_l, i) => Math.abs(px - (x0 + colW * i)) < EDGE || Math.abs(px - (x0 + colW * (i + 1))) < EDGE); // on a lane border it cannot be told from the border
  const route = (fid: string, tid: string): {pts: Pt[]; segs: Seg[]; bad: number} => {
    let best: {pts: Pt[]; segs: Seg[]; score: number; bad: number} | undefined;
    for (const cand of candidates(fid, tid)) {
      const pts = simplify(cand.pts), segs = segsOf(pts);
      let score = cand.pen + (pts.length - 2) * 12, bad = 0;
      for (const g of segs) {
        score += g.x2 - g.x1 + g.y2 - g.y1;
        for (const o of obstacles) if (hits(g, o, o.text ? 2 : o.node === fid || o.node === tid ? -2 : 4)) bad++;
        for (const p of placed) { if (sameRun(g, p)) bad++; else if (cross(g, p)) score += 80; }
      }
      score += bad * 1000;
      if (!best || score < best.score) best = {pts, segs, score, bad};
    }
    const f = must(rect.get(fid)), t = must(rect.get(tid));
    return best ?? {pts: simplify([{x: colX(fid), y: f.y + f.h}, {x: colX(tid), y: t.y}]), segs: [], bad: 0};
  };
  const order = band.flows.map((f, i) => ({f, i, back: must(rect.get(f.to)).y <= must(rect.get(f.from)).y, span: must(rect.get(f.to)).y - must(rect.get(f.from)).y}))
    .sort((p, q) => Number(p.back) - Number(q.back) || p.span - q.span || p.i - q.i); // the short forward flows take their places first, the loops round the outside last
  // flow conditions: a white chip beside the flow, clear of every flow, node and text. It is placed as soon as its flow is, so the flows after it route round it
  const free = (b: Box): boolean => b.x >= x0 + 2 && b.x + b.w <= x0 + width - 2 && b.y >= y + headH
    && !out.labels.some(o => overlap(b, o)) && ![...rect.values()].some(r => overlap(b, r, 2)) && ![...sideBox.values()].some(r => overlap(b, r))
    && !placed.some(g => hits(g, b, 1));
  const placeChip = (f: {label?: string}, i: number, pts: Pt[]): void => {
    if (!f.label) return;
    const lw = Math.ceil(textWidth(widthOf, f.label, S, 400)) + 2 * CHIP_PAD, lh = S + 8, spots: Pt[] = [];
    pts.slice(1).forEach((q, k) => {
      const a = must(pts[k]);
      if (a.y === q.y) { const d = q.x > a.x ? 1 : -1, near = a.x + d * (6 + lw / 2), mid = (a.x + q.x) / 2; for (const sx of k ? [mid] : [near, mid]) spots.push({x: sx, y: a.y - lh / 2 - 3}, {x: sx, y: a.y + lh / 2 + 3}); }
      else {
        const len = Math.abs(q.y - a.y), d = q.y > a.y ? 1 : -1;
        for (const sy of [...(k ? [] : [a.y + d * (lh / 2 + 4)]), a.y + d * len / 2, a.y + d * (len - lh / 2 - 2)]) spots.push({x: a.x + lw / 2 + 5, y: sy}, {x: a.x - lw / 2 - 5, y: sy});
      }
    });
    const box = (p: Pt): Box => ({x: p.x - lw / 2, y: p.y - lh / 2, w: lw, h: lh});
    const at = spots.find(p => free(box(p))) ?? must(spots[0]), b = box(at);
    out.labels.push({text: f.label, ...b, tx: at.x, ty: b.y + S + 2, size: S, edge: i});
    out.labelBoxes.push({label: f.label, ...b});
    obstacles.push({...b, node: '', text: true});
  };
  const routed = new Map<number, Pt[]>();
  for (const {f, i} of order) {
    if (f.from === f.to) {
      const A = must(rect.get(f.from)), cy = A.y + A.h / 2, r = A.x + A.w, loop = [{x: r, y: cy - 8}, {x: r + 22, y: cy - 8}, {x: r + 22, y: cy + 8}, {x: r, y: cy + 8}];
      routed.set(i, loop); placed.push(...segsOf(loop)); placeChip(f, i, loop);
      continue;
    }
    const r = route(f.from, f.to);
    placed.push(...r.segs); routed.set(i, r.pts); placeChip(f, i, r.pts);
  }
  band.flows.forEach((f, i) => out.edges.push({from: f.from, to: f.to, line: f.line === 'dashed' ? 'dashed' : 'solid', points: must(routed.get(i))}));
  return out;
}
