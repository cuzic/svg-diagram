// classDiagram(): UML classes (name / attributes / methods compartments) and the relations between them, placed in layers
// (graph-layout.ts layoutLayered) so a parent sits above its children. Relations are orthogonal arrows with the UML end
// marks: hollow triangle (inherit / implement), diamond on the whole (compose / aggregate), open arrow (arrow / depend).
import {textWidth} from './atoms.ts';
import {layoutLayered} from './graph-layout.ts';
import type {Pt} from './graph-layout.ts';
import {routeLayered} from './layered-route.ts';
import type {ClassesBand, FontFamily, LaidOutClasses, Roles, WidthOf} from './types.ts';

const PAD_X = 12, PAD_Y = 6, MIN_W = 110, GAP = 36, LEVEL_GAP = 72, LOOP = 26, CHIP_PAD = 5;
const lineH = (s: number): number => Math.round(s * 1.4);

export const RELATION_KINDS = ['assoc', 'arrow', 'inherit', 'implement', 'compose', 'aggregate', 'depend'] as const;

export function classesTexts(band: ClassesBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const c of band.classes) {
    out.push([c.name ?? c.id, roles.body, 700, 'sans'], [`«${c.stereotype ?? ''}»`, roles.note, 400, 'sans'], ['«abstract»', roles.note, 400, 'sans']);
    for (const m of [...(c.attrs ?? []), ...(c.methods ?? [])]) out.push([m, roles.body, 400, 'sans']);
  }
  for (const r of band.relations) for (const t of [r.label, r.fromMult, r.toMult]) if (t) out.push([t, roles.note, 400, 'sans']);
  return out;
}

export function layoutClassesBand(band: ClassesBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutClasses {
  const dir = band.dir ?? 'down', B = roles.body, S = roles.note;
  const ids = new Set<string>();
  for (const c of band.classes) {
    if (typeof c.id !== 'string' || !c.id) throw new Error('classDiagram(): every class needs an id');
    if (ids.has(c.id)) throw new Error(`classDiagram(): duplicate class id "${c.id}"`);
    ids.add(c.id);
  }
  for (const r of band.relations) {
    for (const e of [r.from, r.to]) if (!ids.has(e)) throw new Error(`classDiagram(): relation ${r.from} -> ${r.to} names unknown class "${e}"`);
    if (r.kind !== undefined && !(RELATION_KINDS as readonly string[]).includes(r.kind)) throw new Error(`classDiagram(): relation ${r.from} -> ${r.to} has kind ${String(r.kind)} (use ${RELATION_KINDS.join(' | ')})`);
  }
  // measure each class: header (stereotype, name), attributes, methods
  interface M {head: {text: string; bold: boolean; size: number}[]; attrs: string[]; methods: string[]; w: number; h: number; headH: number; attrsH: number}
  const meas = new Map<string, M>();
  for (const c of band.classes) {
    const head: M['head'] = [];
    const st = c.stereotype ?? (c.abstract ? 'abstract' : undefined);
    if (st) head.push({text: `«${st}»`, bold: false, size: S});
    head.push({text: c.name ?? c.id, bold: true, size: B});
    const attrs = c.attrs ?? [], methods = c.methods ?? [];
    const tw = Math.max(...head.map(l => textWidth(widthOf, l.text, l.size, l.bold ? 700 : 400)), ...[...attrs, ...methods].map(l => textWidth(widthOf, l, B, 400)));
    const headH = 2 * PAD_Y + head.reduce((s, l) => s + lineH(l.size), 0);
    const attrsH = attrs.length ? 2 * PAD_Y + attrs.length * lineH(B) : 0, methodsH = methods.length ? 2 * PAD_Y + methods.length * lineH(B) : 0;
    meas.set(c.id, {head, attrs, methods, w: Math.max(MIN_W, Math.ceil(tw + 2 * PAD_X)), h: headH + attrsH + methodsH, headH, attrsH});
  }
  const labelW = (t: string): number => Math.ceil(textWidth(widthOf, t, S, 400)) + 2 * CHIP_PAD;

  // inheritance and implementation put the parent first (on top); the drawn arrow still runs child -> parent
  const flip = (k: string | undefined): boolean => k === 'inherit' || k === 'implement';
  const nodes = band.classes.map(c => ({id: c.id, size: dir === 'down' ? {w: meas.get(c.id)!.h, h: meas.get(c.id)!.w} : {w: meas.get(c.id)!.w, h: meas.get(c.id)!.h}}));
  const edges = band.relations.map(r => flip(r.kind) ? {from: r.to, to: r.from} : {from: r.from, to: r.to});
  const widestLabel = Math.max(0, ...band.relations.map(r => r.label ? labelW(r.label) : 0));
  const lay = layoutLayered(nodes, edges, {dir: 'right', gap: dir === 'down' ? GAP : GAP, levelGap: dir === 'down' ? LEVEL_GAP + 16 : Math.max(LEVEL_GAP, widestLabel + 40)});
  const swap = (p: Pt): Pt => ({x: p.y, y: p.x});
  const total = {w: dir === 'down' ? lay.h : lay.w, h: dir === 'down' ? lay.w : lay.h};
  const hasLoop = band.relations.some(r => r.from === r.to);
  const reserve = hasLoop ? LOOP + 4 : 0;
  if (total.w + reserve > w + 0.5) throw new Error(`classDiagram(): the figure is ${Math.ceil(total.w + reserve)}px wide but it has ${Math.round(w)}px (use dir: 'right', shorter member lines, or fewer classes on one level)`);
  const dx = x + (w - total.w - reserve) / 2, dy = y;
  const place = (p: Pt): Pt => { const q = dir === 'down' ? swap(p) : p; return {x: q.x + dx, y: q.y + dy}; };
  const out: LaidOutClasses = {
    type: 'classes', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: total.h,
    nodes: [], edges: [], texts: [], labels: [], anchors: [], labelBoxes: [],
  };
  const rects = new Map<string, {x: number; y: number; w: number; h: number}>();
  for (const c of band.classes) {
    const p = lay.nodes.get(c.id)!, m = meas.get(c.id)!;
    const r = dir === 'down' ? {x: p.y + dx, y: p.x + dy, w: m.w, h: m.h} : {x: p.x + dx, y: p.y + dy, w: m.w, h: m.h};
    rects.set(c.id, r);
    const dividers: number[] = [];
    if (m.attrs.length || m.methods.length) dividers.push(r.y + m.headH);
    if (m.attrs.length && m.methods.length) dividers.push(r.y + m.headH + m.attrsH);
    out.nodes.push({...r, tone: c.tone ?? 'plain', dividers});
    out.anchors.push({id: c.id, ...r});
    out.labelBoxes.push({label: c.name ?? c.id, ...r});
    let ty = r.y + PAD_Y;
    for (const l of m.head) { out.texts.push({text: l.text, x: r.x + r.w / 2, y: ty + l.size, size: l.size, bold: l.bold, muted: !l.bold, anchor: 'middle'}); ty += lineH(l.size); }
    ty = r.y + m.headH + PAD_Y;
    for (const l of [...m.attrs, ...m.methods]) {
      if (l === m.methods[0] && m.attrs.length) ty = r.y + m.headH + m.attrsH + PAD_Y;
      out.texts.push({text: l, x: r.x + PAD_X, y: ty + B, size: B, bold: false, muted: false, anchor: 'start'});
      ty += lineH(B);
    }
  }
  const routes = routeLayered(lay, place, 22); // wide steps: two hollow triangles on one side do not touch
  const hit = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const at = (pts: Pt[], t: number): Pt => {
    const len = pts.slice(1).map((p, i) => Math.abs(p.x - pts[i].x) + Math.abs(p.y - pts[i].y));
    let d = len.reduce((a, b) => a + b, 0) * t;
    for (let i = 0; i < len.length; i++) { if (d <= len[i] || i === len.length - 1) { const f = len[i] ? d / len[i] : 0; return {x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f}; } d -= len[i]; }
    return pts[0];
  };
  const chip = (text: string, cands: Pt[]): void => {
    const lw = labelW(text), lh = S + 8;
    const box = (c: Pt) => ({x: c.x - lw / 2, y: c.y - lh / 2, w: lw, h: lh});
    const free = (b: ReturnType<typeof box>): boolean => !out.labels.some(o => hit(b, o)) && !out.nodes.some(n => hit(b, n));
    const c = cands.find(p => free(box(p))) ?? cands[0];
    const b = box(c);
    out.labels.push({text, ...b, tx: c.x, ty: b.y + S + 2});
    out.labelBoxes.push({label: text, ...b});
  };
  /** A point `along` px from the end of a polyline (end 0: the start) and `side` px to its left of the direction of travel. */
  const near = (pts: Pt[], end: 0 | 1, along: number, side: number): Pt => {
    const p = end === 0 ? pts[0] : pts[pts.length - 1], q = end === 0 ? pts[1] : pts[pts.length - 2];
    const ux = Math.sign(q.x - p.x), uy = Math.sign(q.y - p.y);
    return {x: p.x + ux * along - uy * side, y: p.y + uy * along + ux * side};
  };
  lay.edges.forEach((e, i) => {
    const r = band.relations[e.index], kind = r.kind ?? 'assoc';
    const line = kind === 'implement' || kind === 'depend' ? 'dashed' : 'solid';
    if (e.self) {
      const a = rects.get(r.from)!, cy = a.y + a.h / 2, pts = [{x: a.x + a.w, y: cy - 10}, {x: a.x + a.w + LOOP, y: cy - 10}, {x: a.x + a.w + LOOP, y: cy + 10}, {x: a.x + a.w, y: cy + 10}];
      out.edges.push({from: r.from, to: r.to, kind, line, points: pts});
      if (r.label) chip(r.label, [{x: a.x + a.w + LOOP + 4 + labelW(r.label) / 2, y: cy}]);
      return;
    }
    const raw = routes.get(i)!;
    const pts = flip(r.kind) ? [...raw].reverse() : raw; // drawn from the child to the parent
    out.edges.push({from: r.from, to: r.to, kind, line, points: pts});
    if (r.fromMult) chip(r.fromMult, [near(pts, 0, 28, 12), near(pts, 0, 28, -12), near(pts, 0, 40, 12), near(pts, 0, 40, -12)]);
    if (r.toMult) chip(r.toMult, [near(pts, 1, 22, 12), near(pts, 1, 22, -12), near(pts, 1, 34, 12), near(pts, 1, 34, -12)]);
    if (r.label) {
      const lw = labelW(r.label), along = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8].map(t => at(pts, t));
      // on the line first; else beside it (a vertical run takes the chip to its side, a horizontal one above or below)
      chip(r.label, [...along, ...along.flatMap(p => [{x: p.x + lw / 2 + 8, y: p.y}, {x: p.x - lw / 2 - 8, y: p.y}, {x: p.x, y: p.y - 22}, {x: p.x, y: p.y + 22}])]);
    }
  });
  return out;
}
