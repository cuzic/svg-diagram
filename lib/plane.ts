// plane(): a coordinate plane — axes with ticks, points, guide lines, dimension lines, labels — for figures where the point is
// WHERE something is (a map ↔ image coordinate conversion, a position error, a sensor offset). Everything is given in the
// plane's own units; layout turns it into pixels, so nothing here is hand-placed.
//
// The layout also boxes every label it places (labelBoxes), so verify.ts can report two labels that sit on each other or a
// label that leaves the figure — the kind of thing a hand-drawn raw() SVG cannot be checked for.
import {textWidth} from './measure.ts';
import {ROLES} from './tokens.ts';
import type {FontFamily, LaidOutPlane, PlaneBand, PlanePos, PlaneRef, PlaneText, PlaneTone, WidthOf} from './types.ts';

const SIZE = ROLES.note, LABEL_H = 20;
const TICK = 6, DIM_OFFSET = 26, DIM_CHIP_PAD = 6;

/** Every [text, size, weight, font] the plane draws, so the measurer knows them before layout. */
export function planeTexts(band: PlaneBand): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  const add = (s: string | undefined, weight = 400) => { if (s) out.push([s, SIZE, weight, 'sans']); };
  for (const axis of [band.x, band.y]) { add(axis.label, 700); for (const t of ticksOf(axis)) add(t.label); }
  for (const p of band.points ?? []) add(p.label, 700);
  for (const d of band.dims ?? []) add(d.label, 700);
  for (const l of band.labels ?? []) add(l.text, l.bold ? 700 : 400);
  return out;
}

export const fmt = (n: number): string => String(parseFloat(n.toPrecision(3)));
function niceStep(range: number): number {
  const raw = range / 6, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  return mag * (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10);
}
export function ticksOf(axis: PlaneBand['x'], caller = 'plane'): {at: number; label: string}[] {
  if (axis.ticks) return axis.ticks.map(t => typeof t === 'number' ? {at: t, label: fmt(t)} : t);
  const min = axis.min ?? 0, step = axis.step ?? niceStep(axis.max - min), out: {at: number; label: string}[] = [];
  if (!(step > 0) || !Number.isFinite(step)) throw new Error(`${caller}(): an axis step must be a number > 0 (got ${axis.step})`);
  for (let v = min, i = 0; v <= axis.max + step * 1e-9 && i < 200; v = min + ++i * step) out.push({at: v, label: fmt(v)});
  return out;
}

export function layoutPlane(band: PlaneBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutPlane {
  const tw = (s: string, weight = 400) => textWidth(widthOf, s, SIZE, weight);
  const width = Math.min(w, band.width ?? w), left = x + (w - width) / 2, h = band.height;
  const xTicks = ticksOf(band.x), yTicks = ticksOf(band.y);
  const xMin = band.x.min ?? 0, yMin = band.y.min ?? 0, xSpan = band.x.max - xMin;
  if (!(xSpan > 0) || !(band.y.max > yMin)) throw new Error('plane(): each axis needs max > min');
  const yDown = !!band.yDown;

  // margins: room for the y tick labels, the axis names and the x tick labels
  const yTickW = Math.max(0, ...yTicks.map(t => tw(t.label)));
  const padL = Math.ceil(yTickW) + TICK + 14;
  // the x axis name starts past the last tick's label (centred on the axis end), so the two never share space
  const lastTick = xTicks.length ? tw(xTicks[xTicks.length - 1].label) / 2 : 0;
  const xLabelGap = Math.max(14, Math.ceil(lastTick) + 8);
  const padR = band.x.label ? xLabelGap + Math.ceil(tw(band.x.label, 700)) + 8 : Math.max(16, Math.ceil(lastTick) + 4);
  const padT = yDown ? 40 : band.y.label ? 34 : 14;
  const padB = yDown ? (band.y.label ? 36 : 14) : 40;
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
  const addText = (s: string, tx: number, base: number, anchor: 'start' | 'middle' | 'end', tone: PlaneTone, bold = false): void => {
    texts.push({s, x: tx, y: base, anchor, tone, bold});
    const tww = tw(s, bold ? 700 : 400);
    boxes.push({label: s, x: anchor === 'middle' ? tx - tww / 2 : anchor === 'end' ? tx - tww : tx, y: base - SIZE, w: tww, h: LABEL_H});
  };

  const ticks: LaidOutPlane['ticks'] = [];
  for (const t of xTicks) {
    const tx = px(t.at);
    ticks.push({x1: tx, y1: axisY, x2: tx, y2: axisY + (yDown ? -TICK : TICK)});
    inkSeg('a tick mark', ticks[ticks.length - 1]);
    addText(t.label, tx, yDown ? axisY - TICK - 8 : axisY + TICK + 16, 'middle', 'muted');
  }
  for (const t of yTicks) {
    const ty = py(t.at);
    ticks.push({x1: axisX, y1: ty, x2: axisX - TICK, y2: ty});
    inkSeg('a tick mark', ticks[ticks.length - 1]);
    addText(t.label, axisX - TICK - 6, ty + 5, 'end', 'muted');
  }
  // the axes (lines and arrowheads)
  ink('the x axis', {x: axisX, y: axisY - 2, w: plotR - axisX, h: 4});
  ink('the y axis', {x: axisX - 2, y: plotT, w: 4, h: plotB - plotT});
  ink('the x axis arrow', {x: plotR - 10, y: axisY - 5, w: 12, h: 10});
  ink('the y axis arrow', yDown ? {x: axisX - 5, y: plotB - 10, w: 10, h: 12} : {x: axisX - 5, y: plotT - 2, w: 10, h: 12});
  const grid: LaidOutPlane['grid'] = band.grid ? [
    ...xTicks.map(t => ({x1: px(t.at), y1: plotT, x2: px(t.at), y2: plotB})),
    ...yTicks.map(t => ({x1: plotL, y1: py(t.at), x2: plotR, y2: py(t.at)})),
  ] : [];
  if (band.x.label) addText(band.x.label, plotR + xLabelGap, axisY + 5, 'start', 'muted', true);
  if (band.y.label) addText(band.y.label, axisX - 4, yDown ? plotB + 28 : plotT - 14, 'start', 'muted', true);

  const points: LaidOutPlane['points'] = (band.points ?? []).map(p => {
    const q = pt(p.at), tone = p.tone ?? 'accent';
    if (p.label) {
      const at = p.labelAt ?? 'right';
      if (at === 'right') addText(p.label, q.x + 12, q.y + 5, 'start', tone, true);
      else if (at === 'left') addText(p.label, q.x - 12, q.y + 5, 'end', tone, true);
      else if (at === 'above') addText(p.label, q.x, q.y - 14, 'middle', tone, true);
      else addText(p.label, q.x, q.y + 26, 'middle', tone, true);
    }
    ink('a point', {x: q.x - 7, y: q.y - 7, w: 14, h: 14});
    return {x: q.x, y: q.y, tone, shape: p.shape ?? 'dot'};
  });

  const lines: LaidOutPlane['lines'] = (band.lines ?? []).map(l => {
    const a = pt(l.from), b = pt(l.to);
    inkSeg('a guide line', {x1: a.x, y1: a.y, x2: b.x, y2: b.y});
    if (l.arrow) { // the head emit.ts draws: 10 long, 5 each side of the line, tip on `b`; its bounding box is the ink
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      const xs = [b.x, b.x - ux * 10 - uy * 5, b.x - ux * 10 + uy * 5], ys = [b.y, b.y - uy * 10 + ux * 5, b.y - uy * 10 - ux * 5];
      ink('a guide line arrow', {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)});
    }
    return {x1: a.x, y1: a.y, x2: b.x, y2: b.y, tone: l.tone ?? 'muted', dashed: l.dashed ?? true, arrow: !!l.arrow};
  });

  const dims: LaidOutPlane['dims'] = (band.dims ?? []).map((dm, di) => {
    const a = pt(dm.from), b = pt(dm.to), tone = dm.tone ?? 'text';
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    // the dimension line sits `offset` px (default DIM_OFFSET) to the chosen side of the measured segment
    const side = dm.side ?? (Math.abs(dx) >= Math.abs(dy) ? 'above' : 'right');
    const nx0 = -dy / len, ny0 = dx / len; // a normal of the segment
    const want = side === 'above' ? [0, -1] : side === 'below' ? [0, 1] : side === 'left' ? [-1, 0] : [1, 0];
    const sgn = nx0 * want[0] + ny0 * want[1] >= 0 ? 1 : -1;
    const off = dm.offset ?? DIM_OFFSET, ox = sgn * nx0 * off, oy = sgn * ny0 * off;
    const line = {x1: a.x + ox, y1: a.y + oy, x2: b.x + ox, y2: b.y + oy};
    const mx = (line.x1 + line.x2) / 2, my = (line.y1 + line.y2) / 2;
    const lw = tw(dm.label, 700), chip = {x: mx - lw / 2 - DIM_CHIP_PAD, y: my - 12, w: lw + 2 * DIM_CHIP_PAD, h: 24};
    texts.push({s: dm.label, x: mx, y: my + 5, anchor: 'middle', tone, bold: true});
    boxes.push({label: dm.label, ...chip, dim: di});
    inkSeg('a dimension line', line, di);
    inkSeg('a dimension line', {x1: a.x, y1: a.y, x2: line.x1, y2: line.y1}, di);
    inkSeg('a dimension line', {x1: b.x, y1: b.y, x2: line.x2, y2: line.y2}, di);
    return {from: a, to: b, line, ext: [{x1: a.x, y1: a.y, x2: line.x1, y2: line.y1}, {x1: b.x, y1: b.y, x2: line.x2, y2: line.y2}], chip, tone};
  });

  for (const l of band.labels ?? []) {
    const q = pt(l.at);
    addText(l.text, q.x, q.y + 5, l.anchor ?? 'middle', l.tone ?? 'text', !!l.bold);
  }

  return {
    type: 'plane', x, y, w, h, reveal: band.reveal, bounds: {x: left, y, w: width, h},
    axisX, axisY, plotL, plotR, plotT, plotB, yDown,
    ticks, grid, texts, points, lines, dims, labelBoxes: boxes, obstacles,
  };
}
