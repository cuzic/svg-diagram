// Geometry of the elements of an SVG, in the units a browser reports them: the box of a shape is its geometry without the stroke (what
// getBBox() and getBoundingClientRect() of an SVG element give), the box of a text is its glyph cells — from the baseline up by the font's
// ascent and down by its descent, as wide as the advance — measured with the same font files the layout uses (lib/font-metrics.ts).
import {textBox} from './font-metrics.ts';
import {FONT_STACKS} from './tokens.ts';
import {apply, elements, textOf, type El, type Matrix, type Style} from './svg-dom.ts';
import type {FontFamily, FontSpecs} from './types.ts';

import {must} from './must.ts';
export interface Box {x: number; y: number; w: number; h: number}
export type Point = [number, number];

export const boxOf = (pts: Point[]): Box | null => {
  if (!pts.length) return null;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return {x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y};
};
export const unionBox = (boxes: (Box | null)[]): Box | null => {
  const b = boxes.filter((x): x is Box => !!x);
  return b.length ? boxOf(b.flatMap(c => [[c.x, c.y], [c.x + c.w, c.y + c.h]] as Point[])) : null;
};
export const corners = (b: Box): Point[] => [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
export const transformBox = (b: Box, m: Matrix): Box => must(boxOf(corners(b).map(([x, y]) => apply(m, x, y))));

// ---- paths ----

const NUM = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;

/** The sub-paths of a path's `d` as polylines (curves and arcs flattened), each with whether it was closed, and the exact extreme points of its curves (the box of a curve is not the box of its flattening). */
export function flattenPath(d: string): {pts: Point[]; closed: boolean; extrema: Point[]}[] {
  const out: {pts: Point[]; closed: boolean; extrema: Point[]}[] = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, prev = '', fx = 0, fy = 0; // fx, fy: where the command being read starts
  let cur = null as {pts: Point[]; closed: boolean; extrema: Point[]} | null;
  const ws = () => { while (i < d.length && /[\s,]/.test(d[i])) i++; };
  const more = () => { ws(); return i < d.length && /[-+.\d]/.test(d[i]); };
  const num = () => { ws(); NUM.lastIndex = i; const m = NUM.exec(d); if (!m) throw new Error(`path data: a number was expected at ${i}`); i += m[0].length; return parseFloat(m[0]); };
  const flag = () => { ws(); const c = d[i++]; if (c !== '0' && c !== '1') throw new Error(`path data: an arc flag was expected at ${i - 1}`); return c === '1'; };
  const start = (px: number, py: number) => { cur = {pts: [[px, py]], closed: false, extrema: []}; out.push(cur); };
  const line = (px: number, py: number) => { if (!cur) start(fx, fy); must(cur).pts.push([px, py]); };
  const bez = (pts: Point[], n: number) => {
    if (!cur) start(fx, fy);
    must(cur).extrema.push(...curveExtrema(pts));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      if (pts.length === 4) line(u ** 3 * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t ** 3 * pts[3][0], u ** 3 * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t ** 3 * pts[3][1]);
      else line(u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0], u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1]);
    }
  };
  while (true) {
    ws();
    if (i >= d.length) break;
    if (/[A-Za-z]/.test(d[i])) { cmd = d[i++]; if (cmd === 'Z' || cmd === 'z') { if (cur) cur.closed = true; x = sx; y = sy; cur = null; prev = 'z'; continue; } }
    else if (!cmd || !more()) throw new Error(`path data: unexpected "${d[i]}" at ${i}`);
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    fx = x; fy = y;
    switch (C) {
      case 'M': { x = ox + num(); y = oy + num(); sx = x; sy = y; start(x, y); cmd = rel ? 'l' : 'L'; break; }
      case 'L': { x = ox + num(); y = oy + num(); line(x, y); break; }
      case 'H': { x = ox + num(); line(x, y); break; }
      case 'V': { y = oy + num(); line(x, y); break; }
      case 'C': { const p: Point[] = [[x, y], [ox + num(), oy + num()], [ox + num(), oy + num()], [ox + num(), oy + num()]]; bez(p, 24); x = p[3][0]; y = p[3][1]; cx = p[2][0]; cy = p[2][1]; break; }
      case 'S': { const c1: Point = /[CcSs]/.test(prev) ? [2 * x - cx, 2 * y - cy] : [x, y]; const p: Point[] = [[x, y], c1, [ox + num(), oy + num()], [ox + num(), oy + num()]]; bez(p, 24); x = p[3][0]; y = p[3][1]; cx = p[2][0]; cy = p[2][1]; break; }
      case 'Q': { const p: Point[] = [[x, y], [ox + num(), oy + num()], [ox + num(), oy + num()]]; bez(p, 16); x = p[2][0]; y = p[2][1]; cx = p[1][0]; cy = p[1][1]; break; }
      case 'T': { const c1: Point = /[QqTt]/.test(prev) ? [2 * x - cx, 2 * y - cy] : [x, y]; const p: Point[] = [[x, y], c1, [ox + num(), oy + num()]]; bez(p, 16); x = p[2][0]; y = p[2][1]; cx = c1[0]; cy = c1[1]; break; }
      case 'A': {
        let rx = Math.abs(num()), ry = Math.abs(num()); const phi = num() * Math.PI / 180, fa = flag(), fs = flag();
        const x2 = ox + num(), y2 = oy + num();
        for (const p of flattenArc(x, y, rx, ry, phi, fa, fs, x2, y2)) line(p[0], p[1]);
        x = x2; y = y2; rx = ry = 0; break;
      }
      default: throw new Error(`path data: unknown command ${cmd}`);
    }
    prev = cmd;
  }
  return out.filter(s => s.pts.length > 0);
}

function flattenArc(x1: number, y1: number, rx: number, ry: number, phi: number, fa: boolean, fs: boolean, x2: number, y2: number): Point[] {
  if ((x1 === x2 && y1 === y2) || rx === 0 || ry === 0) return [[x2, y2]];
  const c = Math.cos(phi), s = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = c * dx + s * dy, y1p = -s * dx + c * dy;
  const lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2;
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx ** 2 * ry ** 2 - rx ** 2 * y1p ** 2 - ry ** 2 * x1p ** 2, den = rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2;
  const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = k * rx * y1p / ry, cyp = -k * ry * x1p / rx;
  const cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(2, Math.ceil(Math.abs(dt) / (Math.PI / 24)));
  const pts: Point[] = [];
  for (let k2 = 1; k2 <= n; k2++) { const t = t1 + dt * k2 / n; pts.push([cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c]); }
  pts[pts.length - 1] = [x2, y2];
  return pts;
}

/** The points of a Bézier curve (2 or 3 control points after the start) where x or y is extreme. */
function curveExtrema(p: Point[]): Point[] {
  const at = (t: number): Point => {
    const u = 1 - t;
    return p.length === 4
      ? [u ** 3 * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t ** 3 * p[3][0], u ** 3 * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t ** 3 * p[3][1]]
      : [u * u * p[0][0] + 2 * u * t * p[1][0] + t * t * p[2][0], u * u * p[0][1] + 2 * u * t * p[1][1] + t * t * p[2][1]];
  };
  const ts: number[] = [];
  for (const axis of [0, 1]) {
    const v = p.map(q => q[axis]);
    if (p.length === 4) {
      const A = v[3] - 3 * v[2] + 3 * v[1] - v[0], B = 2 * (v[2] - 2 * v[1] + v[0]), C = v[1] - v[0];
      if (Math.abs(A) < 1e-12) { if (Math.abs(B) > 1e-12) ts.push(-C / B); }
      else { const disc = B * B - 4 * A * C; if (disc >= 0) { ts.push((-B + Math.sqrt(disc)) / (2 * A), (-B - Math.sqrt(disc)) / (2 * A)); } }
    } else {
      const den = v[0] - 2 * v[1] + v[2];
      if (Math.abs(den) > 1e-12) ts.push((v[0] - v[1]) / den);
    }
  }
  return ts.filter(t => t > 0 && t < 1).map(at);
}

// ---- shapes ----

export interface Outline {polylines: Point[][]; box: Box | null; /** every point that bounds the shape: the polylines' and the curves' extreme points */ points: Point[]}

const SHAPES = new Set(['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path']);
export const isShape = (e: El) => SHAPES.has(e.tag);

/** A shape's outline as polylines in its own coordinates (what a point-along-the-length walk follows) and its box. `vp` resolves percentages. */
export function outlineOf(el: El, vp: {w: number; h: number}): Outline {
  const n = (name: string, ref: number, d = 0) => {
    const v = el.attrs[name];
    if (v === undefined) return d;
    const m = /^\s*(-?[\d.]+(?:e[-+]?\d+)?)(%|px)?/.exec(v);
    return m ? (m[2] === '%' ? parseFloat(m[1]) * ref / 100 : parseFloat(m[1])) : d;
  };
  let polylines: Point[][] = [], extra: Point[] = [];
  switch (el.tag) {
    case 'rect': { const x = n('x', vp.w), y = n('y', vp.h), w = n('width', vp.w), h = n('height', vp.h); polylines = [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]]; break; }
    case 'circle': case 'ellipse': {
      const cx = n('cx', vp.w), cy = n('cy', vp.h);
      const rx = el.tag === 'circle' ? n('r', Math.hypot(vp.w, vp.h) / Math.SQRT2) : n('rx', vp.w), ry = el.tag === 'circle' ? rx : n('ry', vp.h);
      polylines = [Array.from({length: 65}, (_, k) => [cx + rx * Math.cos(k * Math.PI / 32), cy + ry * Math.sin(k * Math.PI / 32)] as Point)];
      break;
    }
    case 'line': polylines = [[[n('x1', vp.w), n('y1', vp.h)], [n('x2', vp.w), n('y2', vp.h)]]]; break;
    case 'polyline': case 'polygon': {
      const nums = (el.attrs['points'] ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
      const pts: Point[] = [];
      for (let k = 0; k + 1 < nums.length; k += 2) pts.push([nums[k], nums[k + 1]]);
      if (pts.length && el.tag === 'polygon') pts.push(pts[0]);
      polylines = pts.length ? [pts] : [];
      break;
    }
    case 'path': { const sub = flattenPath(el.attrs['d'] ?? ''); polylines = sub.map(s => s.closed ? [...s.pts, s.pts[0]] : s.pts); extra = sub.flatMap(s => s.extrema); break; }
  }
  // the box of a circle/ellipse is exact (a 65-gon through the extreme points has them), of a rect/line/polygon the points', of a curve the flattened one's
  const points = [...polylines.flat(), ...extra];
  return {polylines, box: boxOf(points), points};
}

/** Points along a polyline every `step` (and its end), for asking whether it passes through a box. */
export function sampleAlong(polyline: Point[], step: number): Point[] {
  const out: Point[] = polyline.length ? [polyline[0]] : [];
  let carry = 0;
  for (let k = 1; k < polyline.length; k++) {
    const [ax, ay] = polyline[k - 1], [bx, by] = polyline[k];
    const len = Math.hypot(bx - ax, by - ay);
    for (let at = step - carry; at <= len; at += step) out.push([ax + (bx - ax) * at / len, ay + (by - ay) * at / len]);
    carry = (carry + len) % step;
  }
  if (polyline.length > 1) out.push(polyline[polyline.length - 1]);
  return out;
}

// ---- text ----

/** The font family kind a CSS font-family list resolves to for measuring. */
export function familyKind(fontFamily: string): FontFamily {
  const first = fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  const names = (k: FontFamily) => FONT_STACKS[k].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
  if (names('emoji').includes(first) && first !== 'sans-serif') return 'emoji';
  if (names('mono').includes(first) || first === 'monospace') return 'mono';
  return 'sans';
}

const num1 = (v: string | undefined) => { if (v === undefined) return null; const f = parseFloat(v.trim().split(/[\s,]+/)[0]); return Number.isFinite(f) ? f : null; };

/** One run of a <text> (the text of one tspan, or of the <text> itself) as it is laid out: where its pen starts and how big it is. */
export interface PlacedRun {s: string; style: Style; x: number; y: number; w: number; ascent: number; descent: number}

/** The runs of a <text> element (its tspans included) with the positions they are drawn at, in its own coordinates. */
export function placeRuns(text: El, styles: Map<El, Style>, specs?: FontSpecs): PlacedRun[] {
  const preserve = (e: El) => { for (let p: El | null = e; p; p = p.parent) if (p.attrs['xml:space']) return p.attrs['xml:space'] === 'preserve'; return false; };
  type Run = {s: string; style: Style};
  type Chunk = {x: number; y: number; runs: Run[]};
  const measured = (ch: Chunk) => ch.runs.filter(r => r.s).map(r => ({...textBox(r.s, familyKind(r.style.fontFamily), r.style.fontSize, r.style.fontWeight, specs)}));
  const widthOf = (ch: Chunk) => measured(ch).reduce((a, p) => a + p.w, 0);
  const chunks: Chunk[] = [];
  let chunk: Chunk = {x: (num1(text.attrs['x']) ?? 0) + (num1(text.attrs['dx']) ?? 0), y: (num1(text.attrs['y']) ?? 0) + (num1(text.attrs['dy']) ?? 0), runs: []};
  chunks.push(chunk);
  const keep = preserve(text);
  let atStart = true; // the last character kept was a space (or none yet): collapsing drops the next leading space
  const norm = (s: string) => {
    if (keep) return s.replace(/[\n\r\t]/g, ' ');
    let o = s.replace(/\s+/g, ' ');
    if (atStart && o.startsWith(' ')) o = o.slice(1);
    if (o) atStart = o.endsWith(' ');
    return o;
  };
  const walk = (e: El) => {
    for (const c of e.children) {
      if (typeof c === 'string') { const s = norm(c); if (s) chunk.runs.push({s, style: must(styles.get(e))}); continue; }
      if (c.tag !== 'tspan' && c.tag !== 'a') continue;
      const ax = num1(c.attrs['x']), ay = num1(c.attrs['y']), dx = num1(c.attrs['dx']) ?? 0, dy = num1(c.attrs['dy']) ?? 0;
      if (ax !== null || ay !== null || dx || dy) {
        // an absolute position starts a new text chunk, anchored on its own; a relative shift continues from where the last one ended
        const end = chunk.x + widthOf(chunk);
        chunk = {x: (ax ?? end) + dx, y: (ay ?? chunk.y) + dy, runs: []};
        chunks.push(chunk);
      }
      walk(c);
    }
  };
  walk(text);
  if (!keep) for (let k = chunks.length - 1; k >= 0; k--) { // the whole text's trailing space is dropped
    const rs = chunks[k].runs;
    if (!rs.length) continue;
    rs[rs.length - 1].s = rs[rs.length - 1].s.replace(/ $/, '');
    if (rs[rs.length - 1].s) break;
    rs.pop();
  }
  const placed: PlacedRun[] = [];
  for (const ch of chunks) {
    const runs = ch.runs.filter(r => r.s);
    const parts = measured(ch);
    const total = parts.reduce((a, p) => a + p.w, 0);
    if (!parts.length || total === 0) continue;
    const anchor = ch.runs[0]?.style.textAnchor ?? 'start';
    let x = ch.x - (anchor === 'middle' ? total / 2 : anchor === 'end' ? total : 0);
    parts.forEach((p, i) => { placed.push({...runs[i], x, y: ch.y, ...p}); x += p.w; });
  }
  return placed;
}

/** The box of a <text> element (its tspans included) in its own coordinates, or null when it draws nothing. */
export function textBoxOf(text: El, styles: Map<El, Style>, specs?: FontSpecs): Box | null {
  return unionBox(placeRuns(text, styles, specs).map(p => ({x: p.x, y: p.y - p.ascent, w: p.w, h: p.ascent + p.descent})));
}

export const textContent = (e: El) => textOf(e);
export {elements};
