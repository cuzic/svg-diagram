// plane(): a coordinate plane — axes with ticks, points, guide lines, dimension lines, labels — for figures where the point is
// WHERE something is (a map ↔ image coordinate conversion, a position error, a sensor offset). Everything is given in the
// plane's own units; layout turns it into pixels, so nothing here is hand-placed.
//
// The layout also boxes every label it places (labelBoxes), so verify.ts can report two labels that sit on each other or a
// label that leaves the figure — the kind of thing a hand-drawn raw() SVG cannot be checked for.
import {textWidth} from './atoms.ts';
import type {FontFamily, Rect, WidthOf, Roles} from './types/core.ts';
import type {LaidOutPlane, PlaneBand, PlanePos, PlaneRef, PlaneText, PlaneTone} from './types/figures.ts';

import {must} from './must.ts';
// the same tolerance verify.ts's rectOverlap uses, so what layout avoids is what verification would report
const overlapsRect = (a: Rect, b: Rect): boolean => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;

/**
 * The font-size of every text of a plane(): the ONE place it is read, so measuring (planeTexts), layout and drawing
 * (LaidOutPlane.labelSize) agree. Read from the `roles` the layout was made with.
 */
const sizeOf = (band: PlaneBand, roles: Roles): number => roles[band.labelRole ?? 'note'];
/**
 * The size the fixed pixel values (margins, label offsets, the dimension chip) are scaled from. They were drawn for 14px
 * text: only an explicit labelRole scales them, so a plane without one is laid out exactly as before (fill mode's scaled note included).
 */
const geomOf = (band: PlaneBand, roles: Roles): number => band.labelRole ? sizeOf(band, roles) : 14;
const TICK = 6, DIM_OFFSET = 26, DIM_CHIP_PAD = 6;

/** Every [text, size, weight, font] the plane draws, so the measurer knows them before layout. */
export function planeTexts(band: PlaneBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  const add = (s: string | undefined, weight = 400) => { if (s) out.push([s, sizeOf(band, roles), weight, 'sans']); };
  for (const axis of [band.x, band.y]) { add(axis.label, 700); for (const t of ticksOf(axis)) add(t.label); }
  for (const s of band.stages ?? []) add(typeof s === 'string' ? s : s.name);
  for (const t of band.yTickSample ?? []) add(t);
  for (const p of band.points ?? []) add(p.label, 700);
  for (const d of band.dims ?? []) add(d.label, 700);
  for (const l of band.labels ?? []) add(l.text, l.bold ? 700 : 400);
  return out;
}

/** The n + 1 edges of n stage columns, in axis units: equal widths, or where each column says it ends. */
export function stageEdges(stages: NonNullable<PlaneBand['stages']>, min: number, max: number): number[] {
  const n = stages.length, tos = stages.slice(0, -1).map(st => typeof st === 'string' ? undefined : st.to);
  if (tos.every(t => t === undefined)) return Array.from({length: n + 1}, (_v, i) => min + (max - min) * i / n);
  return [min, ...tos.map(Number), max];
}
export const fmt = (n: number): string => String(parseFloat(n.toPrecision(3)));
function niceStep(range: number): number {
  const raw = range / 6, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  return mag * (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10);
}
export function ticksOf(axis: PlaneBand['x'], caller = 'plane'): {at: number; label: string}[] {
  if (axis.categories) return axis.categories.map((label, i) => ({at: i + 1, label}));
  if (axis.ticks) return axis.ticks.map(t => typeof t === 'number' ? {at: t, label: fmt(t)} : t);
  const min = axis.min ?? 0, step = axis.step ?? niceStep(axis.max - min), out: {at: number; label: string}[] = [];
  if (!(step > 0) || !Number.isFinite(step)) throw new Error(`${caller}(): an axis step must be a number > 0 (got ${axis.step})`);
  for (let v = min, i = 0; v <= axis.max + step * 1e-9 && i < 200; v = min + ++i * step) out.push({at: v, label: fmt(v)});
  return out;
}

type XY = {x: number; y: number};

/** Monotone cubic (Fritsch-Carlson) through points whose x strictly increases: [control 1, control 2, end] per piece. */
function monotoneCurves(p: XY[]): [XY, XY, XY][] {
  const n = p.length, dx: number[] = [], sec: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(must(p[i + 1]).x - must(p[i]).x); sec.push((must(p[i + 1]).y - must(p[i]).y) / must(dx[i])); }
  const m: number[] = [sec[0] ?? 0]; // (with fewer than two points there are no pieces, so m is never read)
  for (let i = 1; i < n - 1; i++) m.push(must(sec[i - 1]) * must(sec[i]) <= 0 ? 0 : 2 / (1 / must(sec[i - 1]) + 1 / must(sec[i])));
  m.push(sec[n - 2] ?? 0);
  for (let i = 0; i < n - 1; i++) { // a flat piece stays flat; a tangent never exceeds 3x the secant
    if (sec[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = must(m[i]) / must(sec[i]), b = must(m[i + 1]) / must(sec[i]), h = Math.hypot(a, b);
    if (h > 3) { m[i] = 3 * a / h * must(sec[i]); m[i + 1] = 3 * b / h * must(sec[i]); }
  }
  return dx.map((d, i): [XY, XY, XY] => [{x: must(p[i]).x + d / 3, y: must(p[i]).y + must(m[i]) * d / 3}, {x: must(p[i + 1]).x - d / 3, y: must(p[i + 1]).y - must(m[i + 1]) * d / 3}, must(p[i + 1])]);
}

/** Centripetal Catmull-Rom (alpha 0.5) as cubic pieces; the ends use a mirrored phantom neighbour. */
function centripetalCurves(p: XY[]): [XY, XY, XY][] {
  const n = p.length, at = (i: number): XY => i < 0 ? {x: 2 * must(p[0]).x - must(p[1]).x, y: 2 * must(p[0]).y - must(p[1]).y} : i >= n ? {x: 2 * must(p[n - 1]).x - must(p[n - 2]).x, y: 2 * must(p[n - 1]).y - must(p[n - 2]).y} : must(p[i]);
  const d = (a: XY, b: XY) => Math.hypot(b.x - a.x, b.y - a.y) ** 0.5;
  const out: [XY, XY, XY][] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = must(p[i]), p2 = must(p[i + 1]), p3 = at(i + 2);
    const d1 = d(p0, p1), d2 = d(p1, p2), d3 = d(p2, p3);
    const c = (k: number, a: XY, b: XY, e: XY, f: number, g: number): XY => ({ // (k²e − f²a + (2k²+3kf+f²)b) / (3k(k+f)) written once for x and y
      x: (k * k * e.x - g * g * a.x + (2 * k * k + 3 * k * f + f * f) * b.x) / (3 * k * (k + f)),
      y: (k * k * e.y - g * g * a.y + (2 * k * k + 3 * k * f + f * f) * b.y) / (3 * k * (k + f)),
    });
    out.push([c(d1, p0, p1, p2, d2, d2), c(d3, p3, p2, p1, d2, d2), p2]);
  }
  return out;
}

const bez = (a: XY, c1: XY, c2: XY, b: XY, t: number): XY => {
  const u = 1 - t;
  return {x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y};
};

export function layoutPlane(band: PlaneBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutPlane {
  const size = sizeOf(band, roles), g = geomOf(band, roles), half = g * 5 / 14, labelH = size + 6;
  const tw = (s: string, weight = 400) => textWidth(widthOf, s, size, weight);
  const width = Math.min(w, band.width ?? w), left = x + (w - width) / 2, h = band.height;
  const xMin = band.x.min ?? 0, yMin = band.y.min ?? 0, xSpan = band.x.max - xMin;
  const stages = band.stages ?? [];
  // stages: column edges (equal widths unless the columns say where they end); the names are the x ticks, each at the middle of its column
  const edges = stageEdges(stages, xMin, band.x.max);
  const xTicks = stages.length ? stages.map((st, i) => ({at: ((edges[i] ?? xMin) + (edges[i + 1] ?? band.x.max)) / 2, label: typeof st === 'string' ? st : st.name})) : ticksOf(band.x), yTicks = ticksOf(band.y);
  if (!(xSpan > 0) || !(band.y.max > yMin)) throw new Error('plane(): each axis needs max > min');
  const yDown = !!band.yDown;

  // margins: room for the y tick labels, the axis names and the x tick labels
  const yTickW = Math.max(0, ...yTicks.map(t => tw(t.label)), ...(band.yTickSample ?? []).map(t => tw(t)));
  const padL = Math.ceil(yTickW) + TICK + 14;
  // the x axis name starts past the last tick's label (centred on the axis end), so the two never share space
  const lastTick = xTicks.length ? tw(must(xTicks[xTicks.length - 1]).label) / 2 : 0;
  const xLabelGap = Math.max(14, Math.ceil(lastTick) + 8);
  let padR = band.x.label ? xLabelGap + Math.ceil(tw(band.x.label, 700)) + 8 : Math.max(16, Math.ceil(lastTick) + 4);
  // endLabels: the right margin holds the widest label of a point labelled on its right (a label at fraction t of the plot is wholly inside when padR >= (14 + w - (1 - t)(W - padL)) / t)
  const isLeader = (p: NonNullable<PlaneBand['points']>[number]): boolean => !!p.labelLeader && !!p.label && (p.labelAt === undefined || p.labelAt === 'auto') && !p.labelOffset;
  const isEnd = (p: NonNullable<PlaneBand['points']>[number]): boolean => !!band.endLabels && !!p.label && p.labelAt === 'right' && !p.labelOffset;
  for (const p of band.points ?? []) if (isLeader(p)) padR = Math.max(padR, Math.ceil(tw(p.label as string, 700)) + 10); // the margin column a leader label may move to
  for (const p of band.points ?? []) if (isEnd(p)) {
    const t = (p.at[0] - xMin) / xSpan;
    if (t > 0.05) padR = Math.max(padR, Math.ceil((14 + tw(p.label as string, 700) - (1 - t) * (width - padL)) / t));
  }
  const edge = Math.max(14, Math.ceil(g / 2) + 7); // half a tick label plus the gap, for a margin with no label of its own
  const padT = yDown ? g + 26 : band.y.label ? g + 20 : edge;
  const padB = yDown ? (band.y.label ? g + 22 : edge) : g + 26;
  const plotL = left + padL, plotR = left + width - padR, plotT = y + padT, plotB = y + h - padB;
  if (plotR - plotL < 60 || plotB - plotT < 60) throw new Error('plane(): the figure is too small for its axes — raise height / width');
  const px = (v: number) => plotL + (v - xMin) / xSpan * (plotR - plotL);
  const py = (v: number) => yDown ? plotT + (v - yMin) / (band.y.max - yMin) * (plotB - plotT) : plotB - (v - yMin) / (band.y.max - yMin) * (plotB - plotT);
  const byId = new Map((band.points ?? []).filter(p => p.id).map(p => [p.id as string, p.at]));
  const pos = (r: PlaneRef): PlanePos => {
    if (typeof r !== 'string') return r;
    const p = byId.get(r);
    if (!p) throw new Error(`plane(): "${r}" is not a point id (declare it with points: [{id: '${r}', at: [x, y]}])`);
    return p;
  };
  const pt = (r: PlaneRef): {x: number; y: number} => { const [vx, vy] = pos(r); return {x: px(vx), y: py(vy)}; };

  const axisY = yDown ? plotT : plotB, axisX = plotL;
  const texts: PlaneText[] = [];
  const boxes: LaidOutPlane['labelBoxes'] = [];
  const obstacles: LaidOutPlane['obstacles'] = [];
  const ink = (what: string, r: {x: number; y: number; w: number; h: number}, dim?: number) => obstacles.push({what, ...r, dim});
  // a segment as small squares along it, so a diagonal line does not block its whole bounding box
  const inkSeg = (what: string, s: {x1: number; y1: number; x2: number; y2: number}, dim?: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 6));
    for (let i = 0; i <= n; i++) ink(what, {x: s.x1 + (s.x2 - s.x1) * i / n - 2, y: s.y1 + (s.y2 - s.y1) * i / n - 2, w: 4, h: 4}, dim);
  };
  const addText = (s: string, tx: number, base: number, anchor: 'start' | 'middle' | 'end', tone: PlaneTone, bold = false, reveal?: number): void => {
    texts.push({s, x: tx, y: base, anchor, tone, bold, ...(reveal ? {reveal} : {})});
    const tww = tw(s, bold ? 700 : 400);
    boxes.push({label: s, x: anchor === 'middle' ? tx - tww / 2 : anchor === 'end' ? tx - tww : tx, y: base - size, w: tww, h: labelH});
  };

  const ticks: LaidOutPlane['ticks'] = [];
  for (const t of xTicks) {
    const tx = px(t.at);
    if (!stages.length) { // stage names are column names: no tick mark under them
      const tick = {x1: tx, y1: axisY, x2: tx, y2: axisY + (yDown ? -TICK : TICK)};
      ticks.push(tick);
      inkSeg('a tick mark', tick);
    }
    addText(t.label, tx, yDown ? axisY - TICK - 8 : axisY + TICK + g + 2, 'middle', 'muted');
  }
  for (const t of yTicks) {
    const ty = py(t.at);
    const tick = {x1: axisX, y1: ty, x2: axisX - TICK, y2: ty};
    ticks.push(tick);
    inkSeg('a tick mark', tick);
    addText(t.label, axisX - TICK - 6, ty + half, 'end', 'muted');
  }
  // the axes (lines and arrowheads)
  ink('the x axis', {x: axisX, y: axisY - 2, w: plotR - axisX, h: 4});
  ink('the y axis', {x: axisX - 2, y: plotT, w: 4, h: plotB - plotT});
  ink('the x axis arrow', {x: plotR - 10, y: axisY - 5, w: 12, h: 10});
  ink('the y axis arrow', yDown ? {x: axisX - 5, y: plotB - 10, w: 10, h: 12} : {x: axisX - 5, y: plotT - 2, w: 10, h: 12});
  const grid: LaidOutPlane['grid'] = band.grid ? [
    ...(stages.length ? [] : xTicks).map(t => ({x1: px(t.at), y1: plotT, x2: px(t.at), y2: plotB})),
    ...yTicks.map(t => ({x1: plotL, y1: py(t.at), x2: plotR, y2: py(t.at)})),
  ] : [];
  if (band.x.label) addText(band.x.label, plotR + xLabelGap, axisY + half, 'start', 'muted', true);
  if (band.y.label) addText(band.y.label, axisX - 4, yDown ? plotB + g + 14 : plotT - 14, 'start', 'muted', true);

  // A point label's spot for a side: the text anchor, its x, and its baseline.
  type Side = 'right' | 'left' | 'above' | 'below' | 'above-right' | 'above-left' | 'below-right' | 'below-left';
  const spot = (side: Side, q: {x: number; y: number}): {anchor: 'start' | 'middle' | 'end'; x: number; base: number} => {
    switch (side) {
      case 'right': return {anchor: 'start', x: q.x + 12, base: q.y + half};
      case 'left': return {anchor: 'end', x: q.x - 12, base: q.y + half};
      case 'above': return {anchor: 'middle', x: q.x, base: q.y - 14};
      case 'below': return {anchor: 'middle', x: q.x, base: q.y + g + 12};
      case 'above-right': return {anchor: 'start', x: q.x + 10, base: q.y - 12};
      case 'above-left': return {anchor: 'end', x: q.x - 10, base: q.y - 12};
      case 'below-right': return {anchor: 'start', x: q.x + 10, base: q.y + g + 10};
      default: return {anchor: 'end', x: q.x - 10, base: q.y + g + 10};
    }
  };
  const SIDES: Side[] = ['right', 'left', 'above', 'below', 'above-right', 'above-left', 'below-right', 'below-left'];
  const endLabels: {text: number; box: number; y: number; from?: {x: number; y: number}}[] = [];
  const autoLabels: {text: number; box: number; q: {x: number; y: number}; label: string; bold: boolean; first: Side; leader: boolean}[] = [];
  const points: LaidOutPlane['points'] = (band.points ?? []).map(p => {
    const q = pt(p.at), tone = p.tone ?? 'accent';
    if (p.label) {
      const side: Side = p.labelAt === undefined || p.labelAt === 'auto' ? 'right' : p.labelAt;
      const sp = spot(side, q), [ox, oy] = p.labelOffset ?? [0, 0];
      if (p.labelAt === undefined || p.labelAt === 'auto') {
        if (!p.labelOffset && !isEnd(p)) autoLabels.push({text: texts.length, box: boxes.length, q, label: p.label, bold: true, first: side, leader: isLeader(p)});
      }
      addText(p.label, sp.x + ox, sp.base + oy, sp.anchor, tone, true, p.reveal);
    }
    if (isEnd(p)) endLabels.push({text: texts.length - 1, box: boxes.length - 1, y: q.y});
    ink('a point', {x: q.x - 7, y: q.y - 7, w: 14, h: 14});
    return {x: q.x, y: q.y, tone, shape: p.shape ?? 'dot', ...(p.reveal ? {reveal: p.reveal} : {})};
  });

  const lines: LaidOutPlane['lines'] = (band.lines ?? []).map(l => {
    const a = pt(l.from), b = pt(l.to);
    inkSeg('a guide line', {x1: a.x, y1: a.y, x2: b.x, y2: b.y});
    if (l.arrow) { // the head emit.ts draws: 10 long, 5 each side of the line, tip on `b`; its bounding box is the ink
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      const xs = [b.x, b.x - ux * 10 - uy * 5, b.x - ux * 10 + uy * 5], ys = [b.y, b.y - uy * 10 + ux * 5, b.y - uy * 10 - ux * 5];
      ink('a guide line arrow', {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)});
    }
    return {x1: a.x, y1: a.y, x2: b.x, y2: b.y, tone: l.tone ?? 'muted', dashed: l.dashed ?? !stages.length, arrow: !!l.arrow, ...(l.reveal ? {reveal: l.reveal} : {})};
  });

  // stage dividers, then each evolving point's ring and arrow (the arrow stops at the ring's edge)
  for (let i = 1; i < stages.length; i++) {
    const dx = px(must(edges[i])), seg = {x1: dx, y1: plotT, x2: dx, y2: plotB};
    inkSeg('a stage divider', seg);
    lines.push({...seg, tone: 'muted', dashed: true, arrow: false});
  }
  // Points are told apart by index, not by name: a point may have no label, or share one.
  const clashes: string[] = [];
  const pts = band.points ?? [], nameOf = (p: (typeof pts)[number]): string => p.label ?? p.id ?? 'a point';
  const dots: {x: number; y: number; owner: number; target: boolean; name: string}[] = pts.map((p, i) => ({...pt(p.at), owner: i, target: false, name: nameOf(p)}));
  pts.forEach((p, i) => {
    if (!p.evolves) return;
    const a = pt(p.at), b = {x: px(p.evolves.to), y: a.y}, len = b.x - a.x, stop = {x: b.x - Math.min(8, len / 2), y: b.y}, name = nameOf(p);
    inkSeg('an evolution arrow', {x1: a.x, y1: a.y, x2: stop.x, y2: stop.y});
    ink('an evolution arrow', {x: stop.x - 10, y: stop.y - 5, w: 12, h: 10});
    ink('a point', {x: b.x - 7, y: b.y - 7, w: 14, h: 14});
    points.push({x: b.x, y: b.y, tone: 'muted', shape: 'ring', ...(p.reveal ? {reveal: p.reveal} : {})});
    lines.push({x1: a.x, y1: a.y, x2: stop.x, y2: stop.y, tone: p.tone ?? 'accent', dashed: true, arrow: true, ...(p.reveal ? {reveal: p.reveal} : {})});
    dots.push({...b, owner: i, target: true, name});
    if (len < 24) clashes.push(`plane: "${name}" (point ${i + 1}) evolves only ${Math.round(len)}px to the right, too short to draw the arrow (move evolves.to further right or widen the figure)`);
  });
  // Two points whose drawings meet (a point, its arrow, its target ring) are reported once as a pair, whichever way round and however many parts touch.
  // At least one of the two must evolve; two plain points that overlap have never been checked.
  const parts = (i: number) => dots.filter(d => d.owner === i), near = (a: {x: number; y: number}, b: {x: number; y: number}) => Math.hypot(a.x - b.x, a.y - b.y) < 14;
  const onArrow = (i: number, d: {x: number; y: number}) => { // d lies on the arrow of point i: between its start and its ring, within the arrow head's reach
    const ring = parts(i).find(q => q.target), src = parts(i).find(q => !q.target);
    return !!ring && !!src && Math.abs(d.y - src.y) < 12 && d.x > src.x + 7 && d.x < ring.x - 7;
  };
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    if (!pts[i]?.evolves && !pts[j]?.evolves) continue;
    const pi = parts(i), pj = parts(j);
    if (pi.some(a => pj.some(b => near(a, b))) || pj.some(b => onArrow(i, b)) || pi.some(a => onArrow(j, a))) {
      const tag = (k: number) => `"${nameOf(must(pts[k]))}" (point ${k + 1})`;
      clashes.push(`plane: ${tag(i)} and ${tag(j)} overlap — a point, an evolution arrow or a target ring of one meets the other (move a point, or change evolves.to)`);
    }
  }

  const paths: NonNullable<LaidOutPlane['paths']> = (band.paths ?? []).map(pa => {
    if (pa.through.length < 2) throw new Error('plane(): a path needs at least 2 points in `through`');
    const raw = pa.through.map(pt), kept = raw.map((q, i) => i === 0 || q.x !== must(raw[i - 1]).x || q.y !== must(raw[i - 1]).y);
    const pts = raw.filter((_q, i) => kept[i]);
    // a growing path's pieces, one per kept segment: the stage of the segment that ends at that point
    const sr = pa.segReveal, segReveal = sr ? raw.map((_q, i) => i).filter(i => i > 0 && kept[i]).map(i => must(sr[i - 1])) : undefined;
    if (pts.length < 2) throw new Error('plane(): a path needs at least 2 different points in `through`');
    const curves = !pa.smooth ? [] : pts.every((q, i) => i === 0 || q.x > must(pts[i - 1]).x) ? monotoneCurves(pts) : centripetalCurves(pts);
    const samples: XY[] = [must(pts[0])];
    if (curves.length) curves.forEach(([c1, c2, e], i) => {
      const a = must(pts[i]), n = Math.max(8, Math.ceil(Math.hypot(e.x - a.x, e.y - a.y) / 6));
      for (let k = 1; k <= n; k++) samples.push(bez(a, c1, c2, e, k / n));
    });
    else samples.push(...pts.slice(1));
    for (let i = 1; i < samples.length; i++) inkSeg('a path', {x1: must(samples[i - 1]).x, y1: must(samples[i - 1]).y, x2: must(samples[i]).x, y2: must(samples[i]).y});
    const end = must(pts[pts.length - 1]), from = curves.length ? must(curves[curves.length - 1])[1] : must(pts[pts.length - 2]);
    let ux = end.x - from.x, uy = end.y - from.y;
    if (Math.hypot(ux, uy) < 1e-6) { ux = end.x - must(pts[pts.length - 2]).x; uy = end.y - must(pts[pts.length - 2]).y; }
    const len = Math.hypot(ux, uy) || 1;
    ux /= len; uy /= len;
    if (pa.arrow) { // the head emit.ts draws, as for a guide line
      const xs = [end.x, end.x - ux * 10 - uy * 5, end.x - ux * 10 + uy * 5], ys = [end.y, end.y - uy * 10 + ux * 5, end.y - uy * 10 - ux * 5];
      ink('a path arrow', {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)});
    }
    const overshoot = Math.max(0, ...samples.map(q => Math.max(plotL - q.x, q.x - plotR, plotT - q.y, q.y - plotB)));
    return {pts, curves, tone: pa.tone ?? 'accent', dashed: pa.dashed ?? false, arrow: !!pa.arrow, tip: {dx: ux, dy: uy}, reveal: pa.reveal, ...(segReveal ? {segReveal} : {}), overshoot};
  });

  const dims: LaidOutPlane['dims'] = (band.dims ?? []).map((dm, di) => {
    const a = pt(dm.from), b = pt(dm.to), tone = dm.tone ?? 'text';
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    // the dimension line sits `offset` px (default DIM_OFFSET) to the chosen side of the measured segment
    const side = dm.side ?? (Math.abs(dx) >= Math.abs(dy) ? 'above' : 'right');
    const nx0 = -dy / len, ny0 = dx / len; // a normal of the segment
    const want = side === 'above' ? [0, -1] : side === 'below' ? [0, 1] : side === 'left' ? [-1, 0] : [1, 0];
    const sgn = nx0 * must(want[0]) + ny0 * must(want[1]) >= 0 ? 1 : -1;
    const off = dm.offset ?? DIM_OFFSET * g / 14, ox = sgn * nx0 * off, oy = sgn * ny0 * off;
    const line = {x1: a.x + ox, y1: a.y + oy, x2: b.x + ox, y2: b.y + oy};
    const mx = (line.x1 + line.x2) / 2, my = (line.y1 + line.y2) / 2;
    const lw = tw(dm.label, 700), chipH = g + 10, chip = {x: mx - lw / 2 - DIM_CHIP_PAD, y: my - chipH / 2, w: lw + 2 * DIM_CHIP_PAD, h: chipH};
    texts.push({s: dm.label, x: mx, y: my + half, anchor: 'middle', tone, bold: true, ...(dm.reveal ? {reveal: dm.reveal} : {})});
    boxes.push({label: dm.label, ...chip, dim: di});
    inkSeg('a dimension line', line, di);
    inkSeg('a dimension line', {x1: a.x, y1: a.y, x2: line.x1, y2: line.y1}, di);
    inkSeg('a dimension line', {x1: b.x, y1: b.y, x2: line.x2, y2: line.y2}, di);
    return {from: a, to: b, line, ext: [{x1: a.x, y1: a.y, x2: line.x1, y2: line.y1}, {x1: b.x, y1: b.y, x2: line.x2, y2: line.y2}], chip, tone, ...(dm.reveal ? {reveal: dm.reveal} : {})};
  });

  for (const l of band.labels ?? []) {
    const q = pt(l.at);
    addText(l.text, q.x + (l.offset?.[0] ?? 0), q.y + half + (l.offset?.[1] ?? 0), l.anchor ?? 'middle', l.tone ?? 'text', !!l.bold, l.reveal);
  }

  // An automatic point label that sits on the plane's ink (a dimension line and its extension lines included) or on another label moves to the first side that is free (all taken: stays).
  const hits = (b: Rect, self: number): boolean =>
    b.x < left - 0.5 || b.x + b.w > left + width + 0.5 || b.y < y - 0.5 || b.y + b.h > y + h + 0.5
    || obstacles.some(ob => overlapsRect(b, ob))
    || boxes.some((o, i) => i !== self && overlapsRect(b, o));
  for (const a of autoLabels) {
    if (!hits(must(boxes[a.box]), a.box)) continue;
    let moved = false;
    const tww = tw(a.label, 700);
    for (const side of SIDES) {
      if (side === a.first) continue;
      const sp = spot(side, a.q);
      const box = {x: sp.anchor === 'middle' ? sp.x - tww / 2 : sp.anchor === 'end' ? sp.x - tww : sp.x, y: sp.base - size, w: tww, h: labelH};
      if (hits(box, a.box)) continue;
      texts[a.text] = {...must(texts[a.text]), x: sp.x, y: sp.base, anchor: sp.anchor};
      boxes[a.box] = {...must(boxes[a.box]), ...box};
      moved = true;
      break;
    }
    // no side is free: to the margin column, on a leader (it is spread with the end labels below)
    if (!moved && a.leader) {
      const x0 = plotR + 8, base = a.q.y + half, tww2 = tw(a.label, 700);
      texts[a.text] = {...must(texts[a.text]), x: x0, y: base, anchor: 'start'};
      boxes[a.box] = {...must(boxes[a.box]), x: x0, y: base - size, w: tww2, h: labelH};
      endLabels.push({text: a.text, box: a.box, y: a.q.y, from: a.q});
    }
  }

  // end labels: where two would touch, spread them apart (top to bottom, then back up from the bottom), keeping them on their points as near as possible
  if (endLabels.length >= 1) {
    const sorted = [...endLabels].sort((a, b) => a.y - b.y), pitch = labelH + 2;
    const lo = plotT + size - 2, hi = plotB - 18; // a label's baseline stays inside the plot, off the axis
    let ys = sorted.map(e => Math.min(hi, Math.max(lo, e.y + half)));
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(must(ys[i]), must(ys[i - 1]) + pitch);
    if (must(ys[ys.length - 1]) > hi) { ys[ys.length - 1] = hi; for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(must(ys[i]), must(ys[i + 1]) - pitch); }
    ys = ys.map(v => v - half);
    sorted.forEach((e, i) => {
      const base = must(ys[i]) + half; texts[e.text] = {...must(texts[e.text]), y: base}; boxes[e.box] = {...must(boxes[e.box]), y: base - size};
      if (e.from) lines.push({x1: e.from.x, y1: e.from.y, x2: plotR + 4, y2: base - half, tone: 'muted', dashed: true, arrow: false});
    });
  }

  return {
    type: 'plane', id: band.id, x, y, w, h, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), labelSize: size, bounds: {x: left, y, w: width, h},
    axisX, axisY, plotL, plotR, plotT, plotB, yDown,
    ticks, grid, texts, points, lines, ...(paths.length ? {paths} : {}), dims, labelBoxes: boxes, obstacles, ...(clashes.length ? {clashes: [...new Set(clashes)]} : {}),
  };
}
