import {must} from './must.ts';
// Turns the shapes of an SVG fragment (what emit.ts writes) into absolutely positioned HTML elements drawn by CSS alone:
//   rect / circle        -> a box (background, an inset box-shadow for the outline, border-radius; a dashed outline is a border)
//   polygon, filled path -> a box clipped by clip-path: polygon(); curves and arcs are flattened to short segments first
//   stroked path         -> the outline of the stroke (miter joins, butt / square / round caps, dashes) as clip-path: polygon()
//   marker-start / -end  -> the arrowhead, as one more clipped box
// Only polygon() is used (supported everywhere); the curves are flattened finely enough (a point every few pixels) to look smooth, which
// clip-path: shape() would draw exactly but only the newest browsers read. What this cannot express (gradients, filters, other
// transforms, a stroked polygon, a group) stays SVG, and keeps its place in the paint order: the output is a sequence of HTML boxes and
// small inline <svg> chunks, in the order the elements were drawn.

type Pt = {x: number; y: number};
interface Sub {pts: Pt[]; closed: boolean}
type Attrs = Record<string, string>;

const num = (n: number): string => String(+n.toFixed(2));
const px = (n: number): string => `${num(n)}px`;

function attrsOf(s: string): Attrs {
  const a: Attrs = {};
  for (const m of s.matchAll(/([\w:-]+)="([^"]*)"/g)) a[m[1]] = m[2];
  return a;
}

// ---- path -> flattened subpaths -------------------------------------------------------------------------------------------------

function flattenCubic(out: Pt[], p0: Pt, p1: Pt, p2: Pt, p3: Pt): void {
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.hypot(p3.x - p2.x, p3.y - p2.y);
  const n = Math.max(4, Math.ceil(len / 3));
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
}

function flattenArc(out: Pt[], p0: Pt, rx: number, ry: number, rot: number, large: boolean, sweep: boolean, p1: Pt): void {
  if (rx === 0 || ry === 0 || (p0.x === p1.x && p0.y === p1.y)) { out.push(p1); return; }
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = rot * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2;
  const x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy;
  const lam = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sq = Math.max(0, (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) / (rx * rx * y1 * y1 + ry * ry * x1 * x1));
  const co = (large === sweep ? -1 : 1) * Math.sqrt(sq);
  const cx1 = co * rx * y1 / ry, cy1 = -co * ry * x1 / rx;
  const cx = cp * cx1 - sp * cy1 + (p0.x + p1.x) / 2, cy = sp * cx1 + cp * cy1 + (p0.y + p1.y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(4, Math.ceil(Math.abs(dt) * Math.max(rx, ry) / 3));
  for (let i = 1; i <= n; i++) {
    const t = t1 + dt * i / n;
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    out.push({x: cp * ex - sp * ey + cx, y: sp * ex + cp * ey + cy});
  }
  out[out.length - 1] = p1;
}

/** null when the path uses something this does not read. */
export function parsePath(d: string): Sub[] | null {
  if (/[^MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]/.test(d)) return null;
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return null;
  const subs: Sub[] = [];
  let cur: Sub | null = null, i = 0, cmd = '', pos: Pt = {x: 0, y: 0}, start: Pt = {x: 0, y: 0}, lastCtl: Pt | null = null, lastCmd = '';
  const isCmd = (t: string) => /^[A-Za-z]$/.test(t);
  const take = (k: number): number[] | null => {
    if (i + k > tokens.length) return null;
    const v = tokens.slice(i, i + k);
    if (v.some(isCmd)) return null;
    i += k;
    return v.map(Number);
  };
  const open = (p: Pt) => { cur = {pts: [p], closed: false}; subs.push(cur); };
  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    else if (!cmd) return null;
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? pos.x : 0, oy = rel ? pos.y : 0;
    if (C === 'Z') {
      if (cur) (cur as Sub).closed = true;
      pos = start; cur = null; lastCtl = null; lastCmd = 'Z';
      if (i < tokens.length && !isCmd(tokens[i])) return null;
      continue;
    }
    const need = {M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7}[C as 'M'];
    if (!need) return null;
    const v = take(need);
    if (!v) return null;
    if (!cur && C !== 'M') open(pos);
    const sub = cur as Sub | null;
    let p: Pt;
    switch (C) {
      case 'M': p = {x: v[0] + ox, y: v[1] + oy}; open(p); start = p; cmd = rel ? 'l' : 'L'; lastCtl = null; break;
      case 'L': p = {x: v[0] + ox, y: v[1] + oy}; must(sub).pts.push(p); lastCtl = null; break;
      case 'H': p = {x: v[0] + ox, y: pos.y}; must(sub).pts.push(p); lastCtl = null; break;
      case 'V': p = {x: pos.x, y: v[0] + oy}; must(sub).pts.push(p); lastCtl = null; break;
      case 'C': { const c1 = {x: v[0] + ox, y: v[1] + oy}, c2 = {x: v[2] + ox, y: v[3] + oy}; p = {x: v[4] + ox, y: v[5] + oy}; flattenCubic(must(sub).pts, pos, c1, c2, p); lastCtl = c2; break; }
      case 'S': {
        const c1 = lastCtl && /[CS]/i.test(lastCmd) ? {x: 2 * pos.x - lastCtl.x, y: 2 * pos.y - lastCtl.y} : pos;
        const c2 = {x: v[0] + ox, y: v[1] + oy}; p = {x: v[2] + ox, y: v[3] + oy};
        flattenCubic(must(sub).pts, pos, c1, c2, p); lastCtl = c2; break;
      }
      case 'Q': case 'T': {
        let q: Pt;
        if (C === 'Q') { q = {x: v[0] + ox, y: v[1] + oy}; p = {x: v[2] + ox, y: v[3] + oy}; }
        else { q = lastCtl && /[QT]/i.test(lastCmd) ? {x: 2 * pos.x - lastCtl.x, y: 2 * pos.y - lastCtl.y} : pos; p = {x: v[0] + ox, y: v[1] + oy}; }
        flattenCubic(must(sub).pts, pos, {x: pos.x + 2 / 3 * (q.x - pos.x), y: pos.y + 2 / 3 * (q.y - pos.y)}, {x: p.x + 2 / 3 * (q.x - p.x), y: p.y + 2 / 3 * (q.y - p.y)}, p);
        lastCtl = q; break;
      }
      default: p = {x: v[5] + ox, y: v[6] + oy}; flattenArc(must(sub).pts, pos, v[0], v[1], v[2], v[3] !== 0, v[4] !== 0, p); lastCtl = null;
    }
    pos = p; lastCmd = C;
  }
  return subs;
}

// ---- transforms ---------------------------------------------------------------------------------------------------------------------

/** translate() and scale() only; null for anything else. */
function parseTransform(t: string | undefined): ((p: Pt) => Pt) | null {
  if (!t) return p => p;
  let sx = 1, sy = 1, tx = 0, ty = 0;
  for (const m of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const a = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1] === 'translate') { tx += sx * a[0]; ty += sy * (a[1] ?? 0); }
    else if (m[1] === 'scale') { sx *= a[0]; sy *= a[1] ?? a[0]; }
    else return null;
  }
  return p => ({x: p.x * sx + tx, y: p.y * sy + ty});
}

// ---- stroke outline -------------------------------------------------------------------------------------------------------------------

const sub2 = (a: Pt, b: Pt): Pt => ({x: a.x - b.x, y: a.y - b.y});
const unit = (v: Pt): Pt => { const l = Math.hypot(v.x, v.y) || 1; return {x: v.x / l, y: v.y / l}; };

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) if (!out.length || Math.hypot(p.x - out[out.length - 1].x, p.y - out[out.length - 1].y) > 1e-6) out.push(p);
  return out;
}

/** The area a stroke of width 2*hw paints along an open polyline: left side forward, right side back, with caps. Null when it has no length. */
function ribbon(raw: Pt[], hw: number, cap: string): Pt[] | null {
  const pts = dedupe(raw);
  if (pts.length < 2) return null;
  const dirs: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) dirs.push(unit(sub2(pts[i + 1], pts[i])));
  const n = (d: Pt): Pt => ({x: d.y, y: -d.x});
  const left: Pt[] = [], right: Pt[] = [];
  const last = pts.length - 1;
  for (let i = 0; i <= last; i++) {
    const p = pts[i];
    if (i === 0 || i === last) {
      const d = i === 0 ? dirs[0] : dirs[last - 1], nn = n(d);
      const e = cap === 'square' ? (i === 0 ? -hw : hw) : 0;
      const b = {x: p.x + d.x * e, y: p.y + d.y * e};
      left.push({x: b.x + nn.x * hw, y: b.y + nn.y * hw}); right.push({x: b.x - nn.x * hw, y: b.y - nn.y * hw});
      continue;
    }
    const n0 = n(dirs[i - 1]), n1 = n(dirs[i]), dot = n0.x * n1.x + n0.y * n1.y;
    if (dot > -0.5) { // a miter
      const k = hw / (1 + dot);
      left.push({x: p.x + (n0.x + n1.x) * k, y: p.y + (n0.y + n1.y) * k}); right.push({x: p.x - (n0.x + n1.x) * k, y: p.y - (n0.y + n1.y) * k});
    } else { // too sharp: a bevel
      left.push({x: p.x + n0.x * hw, y: p.y + n0.y * hw}, {x: p.x + n1.x * hw, y: p.y + n1.y * hw});
      right.push({x: p.x - n0.x * hw, y: p.y - n0.y * hw}, {x: p.x - n1.x * hw, y: p.y - n1.y * hw});
    }
  }
  // a round cap: a half circle around the end point, on the outside
  const half = (c: Pt, nn: Pt, d: Pt, fromLeft: boolean): Pt[] => {
    const out: Pt[] = [];
    for (let k = 1; k < 8; k++) {
      const a = Math.PI * k / 8, sg = fromLeft ? 1 : -1;
      out.push({x: c.x + hw * (sg * nn.x * Math.cos(a) + sg * d.x * Math.sin(a)), y: c.y + hw * (sg * nn.y * Math.cos(a) + sg * d.y * Math.sin(a))});
    }
    return out;
  };
  const startCap = cap === 'round' ? half(pts[0], n(dirs[0]), dirs[0], false) : [];   // right side -> around the back -> left side
  const endCap = cap === 'round' ? half(pts[last], n(dirs[last - 1]), dirs[last - 1], true) : [];
  return [...startCap, ...left, ...endCap, ...right.reverse()];
}

/** A closed polyline's stroke: the outer ring and the inner ring, as one even-odd polygon. */
function ringStroke(raw: Pt[], hw: number): Pt[] | null {
  const pts = dedupe(raw);
  if (pts.length > 1 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-6) pts.pop();
  if (pts.length < 3) return null;
  const m = pts.length, a: Pt[] = [], b: Pt[] = [];
  for (let i = 0; i < m; i++) {
    const p0 = pts[(i + m - 1) % m], p = pts[i], p1 = pts[(i + 1) % m];
    const d0 = unit(sub2(p, p0)), d1 = unit(sub2(p1, p));
    const n0 = {x: d0.y, y: -d0.x}, n1 = {x: d1.y, y: -d1.x}, dot = n0.x * n1.x + n0.y * n1.y;
    const k = hw / Math.max(1 + dot, 0.25);
    const mv = {x: (n0.x + n1.x) * k, y: (n0.y + n1.y) * k};
    a.push({x: p.x + mv.x, y: p.y + mv.y}); b.push({x: p.x - mv.x, y: p.y - mv.y});
  }
  return [...a, a[0], ...b, b[0], a[0]];
}

/** The pieces of a polyline that a dash pattern paints (arclength based, one run through the whole polyline). */
function dashPieces(pts: Pt[], dash: number[], offset = 0): Pt[][] | null {
  const pat = dash.length % 2 ? [...dash, ...dash] : dash;
  const period = pat.reduce((s, v) => s + v, 0);
  if (!(period > 0)) return null;
  const pieces: Pt[][] = [];
  let idx = 0, left = pat[0], on = true, piece: Pt[] = [pts[0]];
  let o = ((offset % period) + period) % period;
  while (o > 0) { const t = Math.min(o, left); left -= t; o -= t; if (left <= 1e-9) { idx = (idx + 1) % pat.length; left = pat[idx]; on = !on; piece = on ? [pts[0]] : []; } }
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i];
    const b = pts[i + 1];
    let seg = Math.hypot(b.x - a.x, b.y - a.y);
    const d = unit(sub2(b, a));
    while (seg > left) {
      const q = {x: a.x + d.x * left, y: a.y + d.y * left};
      if (on) { piece.push(q); pieces.push(piece); piece = []; } else piece = [q];
      seg -= left; a = q; idx = (idx + 1) % pat.length; left = pat[idx]; on = !on;
      if (pieces.length > 400) return null;
    }
    left -= seg;
    if (on) piece.push(b);
  }
  if (on && piece.length > 1) pieces.push(piece);
  return pieces;
}

// ---- boxes ------------------------------------------------------------------------------------------------------------------------------

function bbox(pts: Pt[]): {x: number; y: number; w: number; h: number} {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return {x: x0, y: y0, w: Math.max(x1 - x0, 0.01), h: Math.max(y1 - y0, 0.01)};
}

function rgba(color: string, opacity: number): string {
  if (opacity >= 1) return color;
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const v = parseInt(m[1], 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${num(opacity)})`;
}

function clipBox(pts: Pt[], color: string, rule: 'nonzero' | 'evenodd', extra = ''): string {
  const b = bbox(pts);
  const poly = pts.map(p => `${px(p.x - b.x)} ${px(p.y - b.y)}`).join(',');
  return `<div class="sd-s" style="left:${px(b.x)};top:${px(b.y)};width:${px(b.w)};height:${px(b.h)};background:${color};clip-path:polygon(${rule},${poly})${extra}"></div>`;
}

/** Subpaths as one polygon: further subpaths join by a bridge walked there and back, which an even-odd fill cancels. */
function joined(subs: Pt[][]): Pt[] {
  const out: Pt[] = [];
  subs.forEach((s, k) => {
    out.push(...s, s[0]);
    if (k > 0) out.push(subs[0][0]);
  });
  return out;
}

// ---- markers ------------------------------------------------------------------------------------------------------------------------------

interface Marker {w: number; h: number; vb: number[]; refX: number; refY: number; userSpace: boolean; fill: string; sub: Sub[]}

function parseMarkers(svg: string): Map<string, Marker> {
  const out = new Map<string, Marker>();
  for (const m of svg.matchAll(/<marker\b([^>]*)>([\s\S]*?)<\/marker>/g)) {
    const a = attrsOf(m[1]), p = /<path\b([^>]*)\/?>/.exec(m[2]);
    if (!a.id || !p) continue;
    const pa = attrsOf(p[1]), sub = parsePath(pa.d ?? '');
    if (!sub) continue;
    out.set(a.id, {w: Number(a.markerWidth ?? 3), h: Number(a.markerHeight ?? 3), vb: (a.viewBox ?? '0 0 10 10').split(/[\s,]+/).map(Number), refX: Number(a.refX ?? 0), refY: Number(a.refY ?? 0), userSpace: a.markerUnits === 'userSpaceOnUse', fill: pa.fill ?? '#000000', sub});
  }
  return out;
}

function arrowHead(mk: Marker, at: Pt, dir: Pt, sw: number): string {
  const sx = mk.w / mk.vb[2] * (mk.userSpace ? 1 : sw), sy = mk.h / mk.vb[3] * (mk.userSpace ? 1 : sw);
  const pts = mk.sub.flatMap(s => s.pts).map(p => {
    const lx = (p.x - mk.refX) * sx, ly = (p.y - mk.refY) * sy;
    return {x: at.x + lx * dir.x - ly * dir.y, y: at.y + lx * dir.y + ly * dir.x};
  });
  return clipBox(pts, mk.fill, 'nonzero');
}

// ---- elements -------------------------------------------------------------------------------------------------------------------------------

const hasStroke = (a: Attrs) => !!a.stroke && a.stroke !== 'none';
const hasFill = (a: Attrs) => a.fill !== 'none' && a.fill !== undefined;
const opacityStyle = (a: Attrs) => a.opacity ? `;opacity:${a.opacity}` : '';

/** CSS boxes for one element, or null when it has to stay SVG. */
function convert(tag: string, a: Attrs, markers: Map<string, Marker>): string | null {
  const unsupported = ['filter', 'mask', 'clip-path', 'style', 'class'].some(k => k in a) || /url\(#/.test(a.fill ?? '') || /url\(#/.test(a.stroke ?? '');
  if (unsupported) return null;
  const sw = hasStroke(a) ? Number(a['stroke-width'] ?? 1) : 0;
  if (tag === 'rect' || tag === 'circle') {
    const r = tag === 'rect'
      ? {x: Number(a.x ?? 0), y: Number(a.y ?? 0), w: Number(a.width), h: Number(a.height), rx: Number(a.rx ?? 0)}
      : {x: Number(a.cx) - Number(a.r), y: Number(a.cy) - Number(a.r), w: 2 * Number(a.r), h: 2 * Number(a.r), rx: Number(a.r)};
    if (![r.x, r.y, r.w, r.h, r.rx].every(Number.isFinite) || a.transform) return null;
    const fill = hasFill(a) ? rgba(a.fill ?? '#000000', Number(a['fill-opacity'] ?? 1)) : 'transparent';
    if (!hasFill(a) && !sw) return '';
    const o = sw / 2;
    const dash = a['stroke-dasharray'] ? (a['stroke-linecap'] === 'round' ? 'dotted' : 'dashed') : '';
    const outline = !sw ? '' : dash ? `;border:${num(sw)}px ${dash} ${a.stroke}` : `;box-shadow:inset 0 0 0 ${num(sw)}px ${a.stroke}`;
    return `<div class="sd-s" style="left:${px(r.x - o)};top:${px(r.y - o)};width:${px(r.w + sw)};height:${px(r.h + sw)};background:${fill};border-radius:${px(r.rx ? r.rx + o : 0)}${outline}${opacityStyle(a)}"></div>`;
  }
  if (tag === 'polygon') {
    if (sw || !hasFill(a) || a.transform) return null;
    const nums = (a.points ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
    if (nums.length < 6 || nums.length % 2 || nums.some(n => !Number.isFinite(n))) return null;
    const pts: Pt[] = [];
    for (let i = 0; i < nums.length; i += 2) pts.push({x: nums[i], y: nums[i + 1]});
    return clipBox(pts, rgba(a.fill, Number(a['fill-opacity'] ?? 1)), 'nonzero', opacityStyle(a));
  }
  if (tag !== 'path') return null;
  const f = parseTransform(a.transform);
  const subs = parsePath(a.d ?? '');
  if (!f || !subs) return null;
  const maps = subs.map(s => ({...s, pts: s.pts.map(f)}));
  const parts: string[] = [];
  const op = opacityStyle(a);
  const fillOn = a.fill === undefined ? !hasStroke(a) : hasFill(a);   // an SVG path with neither attribute fills black
  if (fillOn) {
    const polys = maps.filter(s => s.pts.length >= 3).map(s => s.pts);
    if (polys.length) parts.push(clipBox(joined(polys), rgba(a.fill ?? '#000000', Number(a['fill-opacity'] ?? 1)), a['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero', op));
  }
  if (sw && a.transform && Math.abs(f({x: 1, y: 0}).x - f({x: 0, y: 0}).x) !== 1) return null; // a scaled stroke
  if (sw) {
    const hw = sw / 2, cap = a['stroke-linecap'] ?? 'butt';
    const dash = a['stroke-dasharray'] ? a['stroke-dasharray'].split(/[\s,]+/).map(Number) : null;
    if (dash?.some(n => !Number.isFinite(n))) return null;
    for (const s of maps) {
      if (dash) {
        const pts = s.closed ? [...s.pts, s.pts[0]] : s.pts;
        const pieces = dashPieces(pts, dash);
        if (!pieces) return null;
        // a round cap grows each dash by half the width at both ends, which the pattern's lengths do not count
        for (const pc of pieces) { const poly = ribbon(pc, hw, cap); if (poly) parts.push(clipBox(poly, a.stroke, 'nonzero', op)); }
      } else if (s.closed) {
        const poly = ringStroke(s.pts, hw);
        if (poly) parts.push(clipBox(poly, a.stroke, 'evenodd', op));
      } else {
        const poly = ribbon(s.pts, hw, cap);
        if (poly) parts.push(clipBox(poly, a.stroke, 'nonzero', op));
      }
    }
    // arrowheads: along the first / last segment of the whole path
    const mkOf = (v: string | undefined) => { const m = /url\(#([^)]+)\)/.exec(v ?? ''); return m ? markers.get(m[1]) : undefined; };
    const ms = mkOf(a['marker-start']), me = mkOf(a['marker-end']);
    if ((a['marker-start'] && !ms) || (a['marker-end'] && !me)) return null;
    const first = maps[0]?.pts ?? [], lastPts = maps[maps.length - 1]?.pts ?? [];
    const fp = dedupe(first), lp = dedupe(lastPts);
    if (ms && fp.length >= 2) { const d = unit(sub2(fp[0], fp[1])); parts.push(arrowHead(ms, fp[0], d, sw)); } // auto-start-reverse: points away from the line
    if (me && lp.length >= 2) parts.push(arrowHead(me, lp[lp.length - 1], unit(sub2(lp[lp.length - 1], lp[lp.length - 2])), sw));
  }
  return parts.join('');
}

/** A <g role="img" aria-label> (a badge): its shapes in a zero-size box at the origin that carries the same role and label. */
function convertGroup(el: string, a: Attrs, markers: Map<string, Marker>): string | null {
  if (a.transform || a.filter || a.opacity) return null;
  const inner = el.slice(el.indexOf('>') + 1, el.lastIndexOf('</g>'));
  const parts: string[] = [];
  for (const child of topLevel(inner)) {
    const m = /^<([\w:-]+)([^>]*?)\/?>/.exec(child);
    if (!m || !['rect', 'circle', 'polygon', 'path'].includes(m[1])) return null;
    const css = convert(m[1], attrsOf(m[2]), markers);
    if (css === null) return null;
    parts.push(css);
  }
  const label = a['aria-label'] !== undefined ? ` role="img" aria-label="${a['aria-label']}"` : '';
  return `<div class="sd-g"${label}>${parts.join('')}</div>`;
}

// ---- the whole fragment ----------------------------------------------------------------------------------------------------------------

/** Splits the inside of the <svg> into its top-level elements (a <g>, <defs> … stays one piece). */
function topLevel(inner: string): string[] {
  const out: string[] = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  let depth = 0, from = -1, m: RegExpExecArray | null;
  while ((m = re.exec(inner))) {
    if (m[1]) { depth--; if (depth === 0) { out.push(inner.slice(from, re.lastIndex)); from = -1; } }
    else if (m[4]) { if (depth === 0) out.push(m[0]); }
    else { if (depth === 0) from = m.index; depth++; }
  }
  return out;
}

/** `svg` is one whole <svg …>…</svg>. Returns HTML: converted boxes plus (only for what could not be converted) small inline SVGs. */
export function shapesToCss(svg: string, cls: string): string {
  const open = /^<svg\b([^>]*)>/.exec(svg);
  if (!open) return svg;
  const inner = svg.slice(open[0].length, svg.lastIndexOf('</svg>'));
  const markers = parseMarkers(inner);
  const a = attrsOf(open[1]);
  const wrap = (body: string) => `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="${a.width}" height="${a.height}" viewBox="${a.viewBox}"${/role="img"/.test(body) ? '' : ' aria-hidden="true"'}>${body}</svg>`;
  const out: string[] = [];
  let pending: string[] = [];
  const flush = () => { if (pending.length) { out.push(wrap(pending.join('\n  '))); pending = []; } };
  const defs: string[] = [];
  for (const el of topLevel(inner)) {
    const m = /^<([\w:-]+)([^>]*?)\/?>/.exec(el);
    if (!m) continue;
    const tag = m[1];
    if (tag === 'defs' || tag === 'style' || tag === 'title' || tag === 'desc' || tag === 'metadata') { if (tag === 'defs') defs.push(el); continue; }
    let css: string | null = null;
    if (['rect', 'circle', 'polygon', 'path'].includes(tag)) css = convert(tag, attrsOf(m[2]), markers);
    else if (tag === 'g' && el.endsWith('</g>')) css = convertGroup(el, attrsOf(m[2]), markers);
    if (css === null) pending.push(el); else { flush(); if (css) out.push(css); }
  }
  flush();
  const html = out.join('');
  return /url\(#/.test(html) && defs.length ? `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${defs.join('')}</svg>${html}` : html;
}
