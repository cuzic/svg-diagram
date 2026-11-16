// bpmn({dir: 'v'}): the same business flow with the lanes as columns and the flow running down (ADR 0042). A node's row is its layer
// along the flow; its column is its lane. A flow is routed by trying many orthogonal paths (out of the bottom or a side, into the top or
// a side, along a channel between the rows) and taking the shortest that touches no node or text and runs on no other flow.
import {textWidth} from './atoms.ts';
import {layoutLayered} from './graph-layout.ts';
import type {Pt} from './graph-layout.ts';
import {checkBpmnInput, isEvent, isGate, lineH, measureBpmnNodes, nodePart} from './bpmn.ts';
import type {BpmnMeasure} from './bpmn.ts';
import {must} from './must.ts';
import {partStep} from './parts.ts';
import {nodeRuns} from './tree.ts';
import {wrapText} from './wrap.ts';
import type {Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {BpmnBand, LaidOutBpmn} from './types/diagrams.ts';

const COL_MAX = 240, TASK_MAX = 168, TASK_MIN = 80, HEAD_PAD = 10, TOP_PAD = 26, ROW_GAP = 44, CHIP_PAD = 5, ICON_H = 24, TASK_ICON = 20, EDGE = 6;

interface Box {x: number; y: number; w: number; h: number}
interface Seg {x1: number; x2: number; y1: number; y2: number}
interface Obstacle extends Box {node: string; text: boolean}
interface Candidate {pts: Pt[]; pen: number}
interface Extra extends Pt {d: -1 | 1}

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
  // no fixed number of lanes: the column width comes from the figure's width, so the most lanes is floor(w / (TASK_MIN + 28))
  if (taskMax < TASK_MIN) throw new Error(`bpmn({dir: 'v'}): ${L} lanes leave each column ${colW}px wide (${Math.round(w)}px / ${L}), too narrow for a task (a column needs ${TASK_MIN + 28}px, so this width takes at most ${Math.floor(w / (TASK_MIN + 28))} lanes: use fewer lanes, a wider diagram, or dir: 'h')`);
  const meas = measureBpmnNodes(band, kindOf, taskMax, widthOf, roles, env);
  // a start / end event or gateway names itself beside its shape, in the room the column has to the right (6px from the shape, 2px
  // from the lane border). A name that does not fit there (or would stack in lines of a character or two) goes across the column:
  // a start event's above it (nothing comes into its top), an end event's or a gateway's under it (a gateway then leaves by its sides)
  const widthIn = (ls: string[]): number => Math.max(0, ...ls.map(l => Math.ceil(textWidth(widthOf, l, B, 400))));
  const named = new Map<string, {lines: string[]; at: 'side' | 'above' | 'below'}>();
  const outs = (id: string): number => band.flows.filter(f => f.from === id && f.to !== id).length;
  for (const n of band.nodes) {
    const k = must(kindOf.get(n.id)), m = must(meas.get(n.id));
    if (k === 'task' || !n.label) continue;
    const room = Math.floor(colW / 2 - m.w / 2 - 8), wrap = (maxWidth: number): string[] => wrapText(must(n.label), {maxWidth, atomWidth: a => widthOf(a, B, 400, 'sans'), mode: env.wrap});
    const side = room > 0 ? wrap(room) : [];
    if (side.length && widthIn(side) <= room && (side.length <= 2 || room >= 3 * B)) { named.set(n.id, {lines: side, at: 'side'}); continue; }
    const across = wrap(colW - 16), why = `the name of "${n.id}" (${n.label}) does not fit beside it in its ${colW}px column`;
    if (widthIn(across) > colW - 16) throw new Error(`bpmn({dir: 'v'}): ${why}, nor across it (shorten the name, use fewer lanes or a wider diagram, or dir: 'h')`);
    if (isGate(k) && outs(n.id) > 2) throw new Error(`bpmn({dir: 'v'}): ${why}, and under it, it would block the bottom vertex that one of its ${outs(n.id)} flows needs (shorten the name, use fewer lanes or a wider diagram, or dir: 'h')`);
    named.set(n.id, {lines: across, at: k === 'start' ? 'above' : 'below'});
  }
  const bottomFree = (id: string): boolean => named.get(id)?.at !== 'below'; // a name under the shape takes the bottom vertex
  const laneLines = band.lanes.map(l => wrapText(l.label, {maxWidth: colW - 16, atomWidth: a => widthOf(a, B, 700, 'sans'), mode: env.wrap}));
  const headH = Math.ceil((Math.max(...laneLines.map(ls => ls.length)) * lineH(B) + 2 * HEAD_PAD) / 4) * 4; // on the 4px grid, like the lane borders

  // rows: the layer of each node along the flow; a lane's nodes that share a row are stacked
  const lay = layoutLayered(
    band.nodes.map(n => ({id: n.id, size: {w: must(meas.get(n.id)).w, h: must(meas.get(n.id)).h}})),
    band.flows.map(f => ({from: f.from, to: f.to})),
    {start: band.nodes.filter(n => kindOf.get(n.id) === 'start').map(n => n.id), tighten: false},
  );
  const nRows = Math.max(...lay.layers.values()) + 1;
  const stacks = new Map<string, string[]>();
  for (const n of band.nodes) { const k = `${laneIdx.get(n.lane)}:${lay.layers.get(n.id)}`; stacks.set(k, [...(stacks.get(k) ?? []), n.id]); }
  // the room a node takes above and below its centre: a gateway's name stacks up from just above the centre, an event's is centred
  // beside it, a name under the shape hangs below
  const extentOf = (id: string): {above: number; below: number} => {
    const m: BpmnMeasure = must(meas.get(id)), nm = named.get(id), half = m.h / 2;
    if (!nm) return {above: half, below: half};
    const tH = nm.lines.length * lineH(B);
    if (nm.at === 'below') return {above: half, below: half + 4 + tH};
    if (nm.at === 'above') return {above: half + 4 + tH, below: half};
    if (isGate(must(kindOf.get(id)))) return {above: Math.max(half, tH + 8), below: half};
    const h = Math.max(m.h, tH + 4) / 2;
    return {above: h, below: h};
  };
  const heightOf = (id: string): number => { const e = extentOf(id); return e.above + e.below; };
  const gap = Math.round(ROW_GAP * space), rowH = Array.from({length: nRows}, () => 0);
  for (const [k, list] of stacks) {
    const r = Number(k.split(':')[1]);
    rowH[r] = Math.max(must(rowH[r]), list.reduce((s, id, i) => s + heightOf(id) + (i ? 12 : 0), 0));
  }
  const rowTop: number[] = [];
  rowH.reduce((a, h, i) => (rowTop[i] = a, a + h + gap), y + headH + TOP_PAD);
  const bottom = must(rowTop[nRows - 1]) + must(rowH[nRows - 1]) + TOP_PAD;
  const width = colW * L, x0 = x + Math.floor((w - width) / 8) * 4, height = bottom - y;

  const out: LaidOutBpmn = {
    type: 'bpmn', dir: 'v', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x: x0, y, w: width, h: height,
    lanes: [], nodes: [], icons: [], edges: [], texts: [], labels: [], anchors: [], labelBoxes: [],
    ...(band.focused ? {focused: band.focused} : {}),
  };
  band.lanes.forEach((l, i) => {
    const ls = must(laneLines[i]), top = y + headH / 2 - (ls.length * lineH(B)) / 2, part = partStep('lane', l.id ?? i, l.label);
    out.lanes.push({x: x0 + colW * i, y, w: colW, h: height, labelW: 0, labelH: headH, tone: l.tone ?? 'plain', part});
    ls.forEach((ln, k) => out.texts.push({text: ln, x: x0 + colW * i + colW / 2, y: top + k * lineH(B) + B, size: B, bold: true, muted: false, anchor: 'middle', part}));
  });

  // place nodes: lane centre, row top (stacked in the row, centred on the row's tallest)
  const rect = new Map<string, Box>();
  for (const [k, list] of stacks) {
    const li = Number(k.split(':')[0]), r = Number(k.split(':')[1]), cx = x0 + colW * li + colW / 2;
    let ty = must(rowTop[r]);
    for (const id of list) { const m = must(meas.get(id)), e = extentOf(id); rect.set(id, {x: cx - m.w / 2, y: ty + e.above - m.h / 2, w: m.w, h: m.h}); ty += e.above + e.below + 12; }
  }
  const obstacles: Obstacle[] = [];
  const sideBox = new Map<string, Box>();
  for (const n of band.nodes) {
    const r = must(rect.get(n.id)), m = must(meas.get(n.id)), k = must(kindOf.get(n.id));
    const part = nodePart(n.id, k, n.label ?? n.id);
    out.nodes.push({...r, kind: k, tone: n.tone ?? 'plain', part});
    out.anchors.push({id: n.id, ...r});
    const nb = {label: n.label ?? n.id, ...r};
    out.labelBoxes.push(nb);
    obstacles.push({...r, node: n.id, text: false});
    const iconH = n.icon ? ICON_H : 0;
    if (n.icon) out.icons.push({node: out.nodes.length - 1, name: n.icon, glyph: must(n.iconGlyph), x: r.x + (r.w - TASK_ICON) / 2, y: r.y + 8, size: TASK_ICON, ...(n.iconTone ? {tone: n.iconTone} : {})});
    if (m.lines) { out.texts.push(...nodeRuns({...r, y: r.y + iconH}, m.lines, roles).map(t => ({...t, anchor: 'middle' as const, part}))); continue; }
    const nm = named.get(n.id);
    if (!nm) continue;
    const lines = nm.lines;
    if (nm.at !== 'side') { // above or under the shape, centred
      const cx = r.x + r.w / 2, tw = widthIn(lines), top = nm.at === 'below' ? r.y + r.h + 4 : r.y - 4 - lines.length * lineH(B);
      lines.forEach((ln, i) => {
        const ty = top + i * lineH(B) + B, w2 = Math.ceil(textWidth(widthOf, ln, B, 400));
        out.texts.push({text: ln, x: cx, y: ty, size: B, bold: false, muted: false, anchor: 'middle', part});
        out.labelBoxes.push({label: ln, x: cx - w2 / 2, y: ty - B, w: w2, h: B + 4});
      });
      const box = {x: cx - tw / 2 - 2, y: top - 2, w: tw + 4, h: (lines.length - 1) * lineH(B) + B + 8};
      sideBox.set(n.id, box);
      obstacles.push({...box, node: n.id, text: true});
      continue;
    }
    const gate = isGate(k), lx = r.x + r.w + 6, cy = r.y + r.h / 2, tw = Math.max(...lines.map(l => Math.ceil(textWidth(widthOf, l, B, 400))));
    // a gateway's name sits above the line through its side vertices (so a flow can leave sideways beneath it); an event's is centred on its shape
    const first = gate ? cy - 8 - (lines.length - 1) * lineH(B) : cy + B / 2 - 2 - ((lines.length - 1) * lineH(B)) / 2;
    lines.forEach((ln, i) => {
      const ty = first + i * lineH(B), w2 = Math.ceil(textWidth(widthOf, ln, B, 400));
      out.texts.push({text: ln, x: lx, y: ty, size: B, bold: false, muted: false, anchor: 'start', part});
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
      for (const [ey, g] of ([[s.y, -1], [s.y + s.h, 1]] as const).filter(([, g]) => g < 0 || bottomFree(fid))) for (const td of [1, -1]) for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 16; kx++) {
        const T = {x: tcx + td * half(tid), y: tcy}, gy = ey + g * (17 + ky * 7), xr = T.x + td * (12 + kx * 7);
        if (xr >= x0 + EDGE && xr <= x0 + width - EDGE) c.push({pts: [{x: scx, y: ey}, {x: scx, y: gy}, {x: xr, y: gy}, {x: xr, y: T.y}, T], pen: 40 + (td < 0 ? 10 : 0)});
      }
      return c;
    }
    const gys = [t.y - 17, s.y + s.h + 17, tcy];
    for (let k = 1; k < 6; k++) gys.push(t.y - 17 - k * 7, s.y + s.h + 17 + k * 7);
    const dx = Math.sign(tcx - scx); // a side is the natural one when it faces the other end; entering from the top is the rule
    const exits = [...(bottomFree(fid) ? [{x: scx, y: s.y + s.h, d: 0, pen: 0}] : []), ...[1, -1].map(d => ({x: scx + d * half(fid), y: scy, d, pen: dx === d ? 25 : dx === 0 ? 40 : 80}))];
    // into the top: at the centre, or 12px to a side (the edge of the shape there; two arrowheads 9px wide stay apart) only when the
    // centre and the sides are taken, as when three or more flows come into one event; into a side vertex, but not the right one of an
    // event whose name sits there
    const tk = must(kindOf.get(tid)), tn = named.get(tid), topAt = (d: number): number => tk === 'task' ? t.y : isGate(tk) ? t.y + Math.abs(d) : t.y + t.w / 2 - Math.sqrt((t.w / 2) ** 2 - d * d);
    const entries = [...[0, -12, 12].map(d => ({x: tcx + d, y: topAt(d), d: 0, pen: d ? 130 : 0})),
      ...[-1, 1].filter(d => !(d === 1 && isEvent(tk) && tn?.at === 'side')).map(d => ({x: tcx + d * half(tid), y: tcy, d, pen: d === -dx ? 60 : 120}))];
    for (const ex of exits) for (const en of entries) for (const gy of gys) for (const m of [14, 22, 30]) {
      if (gy < ex.y + 6 || gy > (en.d ? en.y : t.y - 12)) continue;
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
      const pts = simplify(cand.pts), segs = segsOf(pts), n = pts.length, a = must(pts[n - 2]), q = must(pts[n - 1]), ra = must(cand.pts[cand.pts.length - 2]), rq = must(cand.pts[cand.pts.length - 1]);
      // the last run must keep the direction it was made with (a path that doubles back on itself collapses into a run that arrives
      // the wrong way, or into none) and leave room for the arrowhead
      if (Math.sign(q.x - a.x) !== Math.sign(rq.x - ra.x) || Math.sign(q.y - a.y) !== Math.sign(rq.y - ra.y) || Math.abs(q.x - a.x) + Math.abs(q.y - a.y) < 12) continue;
      let score = cand.pen + (pts.length - 2) * 12, bad = 0;
      for (const [k, g] of segs.entries()) {
        score += g.x2 - g.x1 + g.y2 - g.y1;
        // only the first run may touch its own node and only the last its target; the runs between keep 4px off both, as off any box
        for (const o of obstacles) if (hits(g, o, o.text ? 2 : (o.node === fid && k === 0) || (o.node === tid && k === segs.length - 1) ? -2 : 4)) bad++;
        for (const p of placed) { if (sameRun(g, p)) bad++; else if (cross(g, p)) score += 80; }
      }
      score += bad * 1000;
      if (!best || score < best.score) best = {pts, segs, score, bad};
    }
    const f = must(rect.get(fid)), t = must(rect.get(tid));
    if (best) return best;
    const pts = simplify([{x: colX(fid), y: f.y + f.h}, {x: colX(tid), y: t.y}]);
    return {pts, segs: segsOf(pts), bad: 0}; // the flows after it keep off it too
  };
  const order = band.flows.map((f, i) => ({f, i, back: must(rect.get(f.to)).y <= must(rect.get(f.from)).y, span: must(rect.get(f.to)).y - must(rect.get(f.from)).y}))
    .sort((p, q) => Number(p.back) - Number(q.back) || p.span - q.span || p.i - q.i); // the short forward flows take their places first, the loops round the outside last
  // flow conditions: a white chip beside the flow, clear of every flow, node and text. It is placed as soon as its flow is, so the flows after it route round it
  // how many things a chip at `b` would run into (0: free): the figure's edges, the other chips, the nodes, their names, the flows
  // (outside the figure weighs most: a chip that must touch something touches something inside)
  const clash = (b: Box): number => 100 * (Number(b.x < x0 + 2) + Number(b.x + b.w > x0 + width - 2) + Number(b.y < y + headH) + Number(b.y + b.h > y + height - 2))
    + out.labels.filter(o => overlap(b, o)).length + [...rect.values()].filter(r => overlap(b, r, 2)).length + [...sideBox.values()].filter(r => overlap(b, r)).length
    + placed.filter(g => hits(g, b, 1)).length;
  /** The best spot for a flow's condition beside `pts` (and at `extra`: an edge the chip sits above (d −1) or below (d 1), moved
   *  sideways inside the figure), and what it runs into there. */
  const chipSpot = (label: string, pts: Pt[], extra: Extra[] = []): {b: Box; at: Pt; n: number} => {
    const lw = Math.ceil(textWidth(widthOf, label, S, 400)) + 2 * CHIP_PAD, lh = S + 8, spots: Pt[] = [];
    pts.slice(1).forEach((q, k) => {
      const a = must(pts[k]);
      if (a.y === q.y) { const d = q.x > a.x ? 1 : -1, near = a.x + d * (6 + lw / 2), mid = (a.x + q.x) / 2; for (const sx of k ? [mid] : [near, mid]) spots.push({x: sx, y: a.y - lh / 2 - 3}, {x: sx, y: a.y + lh / 2 + 3}); }
      else {
        const len = Math.abs(q.y - a.y), d = q.y > a.y ? 1 : -1;
        for (const sy of [...(k ? [] : [a.y + d * (lh / 2 + 4)]), a.y + d * len / 2, a.y + d * (len - lh / 2 - 2)]) spots.push({x: a.x + lw / 2 + 5, y: sy}, {x: a.x - lw / 2 - 5, y: sy});
      }
    });
    for (const p of extra) spots.push({x: Math.min(Math.max(p.x, x0 + 4 + lw / 2), x0 + width - 4 - lw / 2), y: p.y + p.d * lh / 2});
    const box = (p: Pt): Box => ({x: p.x - lw / 2, y: p.y - lh / 2, w: lw, h: lh});
    // the first free spot; when there is none, the one that runs into the fewest things (`check` then reports what it overlaps)
    let at = must(spots[0]), least = Number.POSITIVE_INFINITY;
    for (const p of spots) { const n = clash(box(p)); if (n < least) { at = p; least = n; } if (n === 0) break; }
    return {b: box(at), at, n: least};
  };
  const placeChip = (f: {label?: string}, i: number, pts: Pt[], extra: Extra[] = []): void => {
    if (!f.label) return;
    const {b, at} = chipSpot(f.label, pts, extra);
    out.labels.push({text: f.label, ...b, tx: at.x, ty: b.y + S + 2, size: S, edge: i});
    out.labelBoxes.push({label: f.label, ...b});
    obstacles.push({...b, node: '', text: true});
  };
  const routed = new Map<number, Pt[]>();
  for (const {f, i} of order) {
    if (f.from === f.to) {
      // a loop on the right side, or on the left when the right one would leave the figure or run into a name or another flow
      const A = must(rect.get(f.from)), cy = A.y + A.h / 2, inset = isGate(must(kindOf.get(f.from))) ? 8 : 0; // a diamond's edge is 8px in at cy ± 8
      const loopOn = (sd: 1 | -1): Pt[] => { const e = sd > 0 ? A.x + A.w - inset : A.x + inset, o = (sd > 0 ? A.x + A.w : A.x) + sd * 22; return [{x: e, y: cy - 8}, {x: o, y: cy - 8}, {x: o, y: cy + 8}, {x: e, y: cy + 8}]; };
      // its condition may also sit above or below the shape at the loop's outer side (beside the loop there is seldom room for it)
      const extraOf = (pts: Pt[]): Extra[] => [{x: must(pts[1]).x, y: A.y - 4, d: -1}, {x: must(pts[1]).x, y: A.y + A.h + 4, d: 1}];
      const loopBad = (pts: Pt[]): number => {
        const o = must(pts[1]).x, segs = segsOf(pts);
        return (o < x0 + EDGE || o > x0 + width - EDGE ? 100 : 0) + (onEdge(o) ? 10 : 0)
          + segs.reduce((n, g) => n + obstacles.filter(ob => (ob.node !== f.from || ob.text) && hits(g, ob, 2)).length + placed.filter(p => sameRun(g, p)).length, 0)
          + (f.label ? chipSpot(f.label, pts, extraOf(pts)).n : 0);
      };
      const right = loopOn(1), left = loopOn(-1), loop = loopBad(left) < loopBad(right) ? left : right;
      routed.set(i, loop); placed.push(...segsOf(loop)); placeChip(f, i, loop, extraOf(loop));
      continue;
    }
    const r = route(f.from, f.to);
    placed.push(...r.segs); routed.set(i, r.pts); placeChip(f, i, r.pts);
  }
  band.flows.forEach((f, i) => out.edges.push({from: f.from, to: f.to, line: f.line === 'dashed' ? 'dashed' : 'solid', points: must(routed.get(i))}));
  return out;
}
