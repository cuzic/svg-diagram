import {textWidth} from './atoms.ts';
import {fmt, ticksOf} from './plane.ts';
import type {BarDatum, BarsBand, BarsInk, BarsLine, ColorKey, FontFamily, LaidOutBars, WidthOf, Roles} from './types.ts';

import {must} from './must.ts';
const SERIES: Record<NonNullable<BarDatum['series']>, ColorKey> = {a: 'accent', b: 'text', c: 'muted'};
const TICK = 6, BAR = 28, GAP = 18, STACK_GAP = 2;

/**
 * The font-size of every label of a bars() band: the ONE place it is read, so measuring (barsTexts), layout and drawing
 * agree. Read from the `roles` the layout was made with.
 */
const sizeOf = (band: BarsBand, roles: Roles): number => roles[band.labelRole ?? 'note'];
/**
 * Bar thickness (horizontal): BAR, or the label's height when the labelRole is bigger than the bar. Only an explicit
 * labelRole grows it, so a band without one is laid out exactly as before (fill mode's scaled note included).
 */
const barH = (band: BarsBand, S: number): number => band.labelRole ? Math.max(BAR, S + 14) : BAR;

/**
 * A bar's value as written, unless valueFormat says otherwise: whole numbers exactly (1055 stays 1055); others to 3 significant
 * digits, but never fewer than the digits of their whole part (1055.5 is 1056, not 1060; 0.01234 is 0.0123).
 */
const valueNum = (v: number, f: BarsBand['valueFormat']): string => {
  if (typeof f === 'function') return String(f(v));
  if (f === 'exact' || Number.isInteger(v) && f === undefined) return String(v);
  if (typeof f === 'number') return v.toFixed(f);
  const whole = Math.abs(v) >= 1 ? Math.floor(Math.log10(Math.abs(v))) + 1 : 0;
  return whole > 3 && whole <= 21 ? String(parseFloat(v.toPrecision(whole))) : fmt(v);
};
const valueText = (d: BarDatum, band: BarsBand) => `${valueNum(d.value, band.valueFormat)}${band.unit ?? ''}`;

/** What a bars() band shows; every default is the original look. */
function flags(band: BarsBand) {
  const labels = band.labels ?? 'all', axis = band.axis !== false;
  return {showValues: labels === 'all', showCats: labels !== 'none', axis, grid: band.grid ?? (axis && !band.cumulative), baseline: band.baseline !== false, labels};
}
/** Values are on neither a label nor a scale: the figure alone cannot be read for them. */
export const barsValuesHidden = (band: BarsBand): boolean => band.labels !== undefined && band.labels !== 'all' && band.axis === false;
/** Text inside / beside a stacked segment: label and value, or what labels: leaves of them. */
const segmentOf = (d: BarDatum, band: BarsBand, labels: 'all' | 'category' | 'none') =>
  labels === 'all' ? `${d.label} ${valueText(d, band)}` : labels === 'category' ? d.label : '';
const series = (d: BarDatum): ColorKey => d.tone ?? SERIES[d.series ?? 'a'];

/** Every string bars() draws, registered before its geometry is calculated. */
export function barsTexts(band: BarsBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  const f = flags(band), S = sizeOf(band, roles);
  for (const d of band.data) {
    if (f.showCats) out.push([d.label, S, 400, 'sans']);
    if (f.showValues) out.push([valueText(d, band), S, 700, 'sans']);
    const seg = segmentOf(d, band, f.labels);
    if (band.stack && seg) out.push([seg, S, 700, 'sans']);
  }
  if (f.axis) for (const t of ticksOf({max: band.max}, 'bars')) out.push([t.label, S, 400, 'sans']);
  for (const l of [...band.lines ?? [], ...band.vlines ?? []]) if (l.label) out.push([l.label, S, 700, 'sans']);
  for (const e of band.edges ?? []) if (e) out.push([e, S, 400, 'sans']);
  if (band.cumulative) {
    for (const p of CUM_TICKS) out.push([`${p}%`, S, 400, 'sans']);
    for (const p of cumulativeOf(band.data)) out.push([cumText(p), S, 700, 'sans']);
    if (f.axis) out.push([fmt(band.max), S, 400, 'sans']); // the total, a tick of the left axis
  }
  return out;
}

/**
 * Where the labels of the vertical reference lines go: centred on their line, or beside it when centred they would leave the plot,
 * each on the lowest row (0 is just above the plot) where it clears the labels already there.
 */
function vlineRows(band: BarsBand, plotL: number, plotR: number, plotT: number, S: number, widthOf: WidthOf, values: {x: number; y: number; w: number; h: number}[]): {rows: number; at: ({x: number; anchor: 'start' | 'middle' | 'end'; row: number} | undefined)[]} {
  const {count} = slotsOf(band.data), slot = (plotR - plotL) / count;
  const placed: {x1: number; x2: number; row: number}[] = [];
  const at = (band.vlines ?? []).map(l => {
    if (!l.label) return undefined;
    const lx = plotL + l.at * slot, tw = textWidth(widthOf, l.label, S, 700);
    const anchor = lx - tw / 2 < plotL + 2 ? 'start' : lx + tw / 2 > plotR - 2 ? 'end' : 'middle';
    const x = anchor === 'start' ? lx + 4 : anchor === 'end' ? lx - 4 : lx, x1 = anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2;
    let row = 0;
    while (placed.some(p => p.row === row && x1 < p.x2 + 6 && p.x1 < x1 + tw + 6) || values.some(b => hitRect({x: x1 - 6, y: plotT - 8 - row * (S + 4) - S, w: tw + 12, h: S + 4}, b))) row++;
    placed.push({x1, x2: x1 + tw, row});
    return {x, anchor: anchor as 'start' | 'middle' | 'end', row};
  });
  return {rows: at.reduce((n, a) => a ? Math.max(n, a.row + 1) : n, 0), at};
}

type VerticalValue = {cx: number; base: number; inside: boolean; box: {x: number; y: number; w: number; h: number}};

/** The places actually chosen for the values of unstacked vertical bars. */
function verticalValues(band: BarsBand, plotL: number, plotR: number, plotT: number, plotB: number, S: number, widthOf: WidthOf, slots: number[], slot: number, bw: number, yOf: (v: number) => number): (VerticalValue | undefined)[] {
  const cumSegs: {x1: number; y1: number; x2: number; y2: number}[] = [];
  if (band.cumulative) {
    const pts = [{x: plotL, y: plotB}, ...cumulativeOf(band.data).map((p, k) => ({x: plotL + (k + 1) * slot, y: plotB - p / 100 * (plotB - plotT)}))];
    pts.slice(1).forEach((q, k) => cumSegs.push({x1: must(pts[k]).x, y1: must(pts[k]).y, x2: q.x, y2: q.y}));
    if (band.cumulative.guide !== undefined) { const gy = plotB - band.cumulative.guide / 100 * (plotB - plotT); cumSegs.push({x1: plotL, y1: gy, x2: plotR, y2: gy}); }
  }
  for (const l of band.lines ?? []) cumSegs.push({x1: plotL, y1: yOf(l.at), x2: plotR, y2: yOf(l.at)});
  const vx = (band.vlines ?? []).map(l => plotL + l.at * slot);
  const dodge = (cx: number, tw: number, lo: number, hi: number): number => {
    const cuts = (c: number) => vx.some(v => v > c - tw / 2 - 3 && v < c + tw / 2 + 3);
    if (!cuts(cx)) return cx;
    const sides = vx.flatMap(v => [v - 3.5 - tw / 2, v + 3.5 + tw / 2]).filter(c => !cuts(c));
    const near = (cs: number[]) => cs.length ? cs.reduce((a, b) => Math.abs(b - cx) < Math.abs(a - cx) ? b : a) : undefined;
    return near(sides.filter(c => c - tw / 2 >= lo + 1 && c + tw / 2 <= hi - 1)) ?? near(sides.filter(c => c - tw / 2 >= lo - tw && c + tw / 2 <= hi + tw)) ?? cx;
  };
  return band.data.map((d, i) => {
    if (band.hideZero && d.value === 0) return undefined;
    const bh = d.value / band.max * (plotB - plotT), bx = plotL + must(slots[i]) * slot + (slot - bw) / 2, rY = plotB - bh;
    const tw = textWidth(widthOf, valueText(d, band), S, 700);
    const cx = dodge(bx + bw / 2, tw, bx, bx + bw), cxOut = dodge(bx + bw / 2, tw, plotL + must(slots[i]) * slot, plotL + (must(slots[i]) + 1) * slot);
    const cut = (at: number, base: number): boolean => cumSegs.some(sg => segHitsRect(sg, {x: at - tw / 2, y: base - S + 2, w: tw, h: S}));
    const fitsIn = (base: number) => bw >= tw + 12 && base - S >= rY && base <= rY + bh && cx - tw / 2 >= bx - 0.5 && cx + tw / 2 <= bx + bw + 0.5;
    const places: {base: number; inside: boolean}[] = [];
    if (bh >= S + 10) places.push({base: rY + S + 4, inside: true});
    places.push({base: rY - 6, inside: false});
    if (bh >= 2 * S + 14) places.push({base: rY + bh - 8, inside: true});
    places.push({base: rY - 6 - S - 6, inside: false});
    if (bh < S + 10 && cumSegs.length) places.push({base: rY + S + 2, inside: true});
    const ok = places.filter(p => !p.inside || fitsIn(p.base));
    const pick = must((cumSegs.length ? ok.find(p => !cut(p.inside ? cx : cxOut, p.base)) : undefined) ?? ok[0] ?? places[1]);
    const at = pick.inside ? cx : cxOut;
    return {cx: at, base: pick.base, inside: pick.inside, box: {x: at - tw / 2, y: pick.base - S, w: tw, h: S + 4}};
  });
}

const hitRect = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
/** Does the segment pass through the rectangle (Liang-Barsky)? */
export function segHitsRect(sg: {x1: number; y1: number; x2: number; y2: number}, r: {x: number; y: number; w: number; h: number}): boolean {
  let t0 = 0, t1 = 1;
  const dx = sg.x2 - sg.x1, dy = sg.y2 - sg.y1;
  for (const [p, q] of [[-dx, sg.x1 - r.x], [dx, r.x + r.w - sg.x1], [-dy, sg.y1 - r.y], [dy, r.y + r.h - sg.y1]] as const) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; t0 = Math.max(t0, t); } else { if (t < t0) return false; t1 = Math.min(t1, t); }
  }
  return t0 <= t1;
}
const CUM_TICKS = [0, 20, 40, 60, 80, 100];
/** Cumulative share (0-100) after each bar, in the order of the data. */
export const cumulativeOf = (data: readonly BarDatum[]): number[] => {
  const total = data.reduce((n, d) => n + d.value, 0);
  let run = 0;
  return data.map(d => { run += d.value; return total > 0 ? run / total * 100 : 0; });
};
const cumText = (pct: number): string => `${Math.round(pct * 10) / 10}%`;
const LINE_TONE: Record<NonNullable<BarsLine['tone']>, ColorKey> = {accent: 'accent', danger: 'danger', muted: 'muted', text: 'text'};

function putText(
  out: LaidOutBars, S: number, text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end', fill: ColorKey,
  widthOf: WidthOf, bold = false, background?: ColorKey, bar?: number,
): void {
  out.texts.push({text, x, y, anchor, fill, size: S, bold, reveal: bar === undefined ? undefined : must(out.bars[bar]).reveal, ...(bar === undefined || must(out.bars[bar]).until === undefined ? {} : {until: must(out.bars[bar]).until}), bar});
  const w = textWidth(widthOf, text, S, bold ? 700 : 400);
  out.labelBoxes.push({label: text, x: anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x, y: y - S, w, h: S + 4, background, bar});
}

function addBar(out: LaidOutBars, d: BarDatum, r: Omit<LaidOutBars['bars'][number], 'fill' | 'id'>): LaidOutBars['bars'][number] {
  const bar = {...r, fill: series(d), id: d.id, reveal: d.reveal, ...(d.until === undefined ? {} : {until: d.until})};
  out.bars.push(bar);
  if (d.id) out.anchors.push({...bar, id: d.id});
  return bar;
}

/** The row / column each bar sits in: a bar that `replaces` another takes that one's slot (they are never on screen together). */
export function slotsOf(data: readonly BarDatum[]): {slots: number[]; count: number} {
  const at = new Map<string, number>(), slots: number[] = [];
  let count = 0;
  for (const d of data) {
    const slot = d.replaces !== undefined ? at.get(d.replaces) : undefined;
    const mine = slot ?? count++;
    slots.push(mine);
    if (d.id) at.set(d.id, mine);
  }
  return {slots, count};
}

export function layoutBars(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutBars {
  return band.dir === 'v' ? layoutVertical(band, x, y, w, widthOf, roles) : layoutHorizontal(band, x, y, w, widthOf, roles);
}

function layoutHorizontal(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutBars {
  const f = flags(band), S = sizeOf(band, roles), BARH = barH(band, S);
  const {slots, count} = slotsOf(band.data);
  const rows = band.stack ? 1 : count;
  // barRatio replaces the bar : gap split of one row pitch; without it BAR / GAP as ever
  const bh = band.barRatio === undefined || band.stack ? BARH : (BARH + GAP) * band.barRatio, gp = band.barRatio === undefined || band.stack ? GAP : BARH + GAP - bh;
  const tickH = f.axis ? S + TICK + 8 : 0;
  const ticks = f.axis ? ticksOf({max: band.max}, 'bars') : [];
  const labelW = band.stack || !f.showCats ? 0 : Math.max(...band.data.map(d => textWidth(widthOf, d.label, S, 400))) + 12;
  const valueW = band.stack || !f.showValues ? 0 : Math.max(...band.data.map(d => textWidth(widthOf, valueText(d, band), S, 700))) + 12;
  const tickPadL = band.stack && f.axis ? textWidth(widthOf, must(ticks[0]).label, S, 400) / 2 : 0;
  const tickPadR = band.stack && f.axis ? textWidth(widthOf, must(ticks[ticks.length - 1]).label, S, 400) / 2 : 0;
  const plotL = x + labelW + tickPadL, plotR = x + w - valueW - tickPadR, plotW = plotR - plotL;
  if (plotW < (f.axis || f.labels !== 'none' ? 80 : 20)) throw new Error('bars(): the figure is too narrow for its labels');
  const segs = band.data.map(d => segmentOf(d, band, f.labels));
  const hasOutside = band.stack && band.data.some((d, i) => segs[i] && d.value / band.max * plotW < textWidth(widthOf, segs[i], S, 700) + 12);
  const outsideH = hasOutside ? S + 6 : 0;
  const needH = rows * bh + Math.max(0, rows - 1) * gp + (f.axis ? tickH + 8 : 0) + outsideH;
  if (band.height !== undefined && band.height < needH) throw new Error(`bars(): height ${band.height} is too small for its content (need at least ${needH})`);
  const h = band.height ?? needH;
  const out: LaidOutBars = {type: 'bars', id: band.id, x, y, w, h, dir: 'h', stack: band.stack, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), bars: [], ticks: [], texts: [], labelBoxes: [], anchors: []};
  const axisY = y + rows * bh + Math.max(0, rows - 1) * gp;
  for (const t of ticks) {
    const tx = plotL + t.at / band.max * plotW;
    // one line (tick + grid) as before; without grid only the short tick; the zero line is the baseline
    if (f.grid && (f.baseline || t.at !== 0)) out.ticks.push({x1: tx, y1: y, x2: tx, y2: axisY + TICK});
    else out.ticks.push({x1: tx, y1: axisY, x2: tx, y2: axisY + TICK});
    putText(out, S, t.label, tx, axisY + outsideH + TICK + S + 2, 'middle', 'muted', widthOf);
  }
  if (f.baseline && !(f.axis && f.grid)) out.ticks.push({x1: plotL, y1: y, x2: plotL, y2: axisY});
  if (band.stack) {
    let at = plotL;
    band.data.forEach((d, i) => {
      const rawW = d.value / band.max * plotW, bw = Math.max(0, rawW - (i < band.data.length - 1 ? STACK_GAP : 0));
      const r = addBar(out, d, {x: at, y, w: bw, h: BARH});
      const bar = out.bars.length - 1;
      const text = must(segs[i]), tw = textWidth(widthOf, text, S, 700);
      if (text && bw >= tw + 12) putText(out, S, text, r.x + r.w / 2, r.y + BARH / 2 + S * .36, 'middle', 'bg', widthOf, true, r.fill, bar);
      else if (text) putText(out, S, text, r.x + r.w / 2, r.y + BARH + S + 4, 'middle', r.fill, widthOf, true, undefined, bar);
      at += rawW;
    });
  } else band.data.forEach((d, i) => {
    const by = y + must(slots[i]) * (bh + gp), bw = d.value / band.max * plotW;
    const r = addBar(out, d, {x: plotL, y: by, w: bw, h: bh});
    const bar = out.bars.length - 1;
    if (f.showCats) putText(out, S, d.label, plotL - 8, by + bh / 2 + S * .36, 'end', 'text', widthOf, false, undefined, bar);
    if (!f.showValues) return;
    const text = valueText(d, band), tw = textWidth(widthOf, text, S, 700);
    if (bw >= tw + 12) putText(out, S, text, plotL + bw - 6, by + bh / 2 + S * .36, 'end', 'bg', widthOf, true, r.fill, bar);
    else putText(out, S, text, plotL + bw + 6, by + bh / 2 + S * .36, 'start', r.fill, widthOf, true, undefined, bar);
  });
  if (f.axis) out.ticks.push({x1: plotL, y1: axisY, x2: plotR, y2: axisY});
  return out;
}

function layoutVertical(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutBars {
  const f = flags(band), S = sizeOf(band, roles);
  const h = band.height ?? 280;
  const ticks = f.axis ? ticksOf({max: band.max}, 'bars') : [];
  // a Pareto's left axis also has the total, where its 100% is
  if (f.axis && band.cumulative && band.max - must(ticks[ticks.length - 1]).at > band.max * 0.08) ticks.push({at: band.max, label: fmt(band.max)});
  const tickW = Math.max(0, ...ticks.map(t => textWidth(widthOf, t.label, S, 400)));
  const cumW = band.cumulative ? Math.max(...CUM_TICKS.map(p => textWidth(widthOf, `${p}%`, S, 400))) + TICK + 10 : 0;
  // the edge labels are centred on the edges, so the first and the last stick out half their width
  const edgeHalf = (i: number) => band.edges ? textWidth(widthOf, band.edges[i] ?? '', S, 400) / 2 : 0;
  const plotL = Math.max(x + (f.axis ? tickW + TICK + 10 : 4), x + edgeHalf(0)), plotR = Math.min(x + w - (band.cumulative ? cumW : 8), x + w - edgeHalf(band.edges ? band.edges.length - 1 : 0) - 2);
  const {slots, count} = slotsOf(band.data), slot = (plotR - plotL) / count;
  const bw = band.barRatio === undefined ? Math.min(64, slot * .62) : slot * band.barRatio;
  const topLabels = [...band.lines ?? [], ...band.vlines ?? []].some(l => l.label);
  const plotB = f.showCats || band.edges ? y + h - S * 1.4 - 14 : y + h - 4;
  const plotTOf = (rows: number) => y + (f.axis || f.showValues || topLabels || band.cumulative ? S + 8 : 4) + Math.max(0, rows - 1) * (S + 4);
  // the labels of the vertical reference lines stand on rows above the plot; one that would touch its neighbour or a value label goes a row higher
  const rowsAt = (rows: number) => {
    const plotT = plotTOf(rows), yOf = (v: number) => plotB - v / band.max * (plotB - plotT);
    const values = f.showValues && !band.stack ? verticalValues(band, plotL, plotR, plotT, plotB, S, widthOf, slots, slot, bw, yOf).flatMap(p => p ? [p.box] : []) : [];
    return vlineRows(band, plotL, plotR, plotT, S, widthOf, values);
  };
  // more rows lower the plot top and the values with it, which can free a row again: settle in a few passes; if the count swings,
  // keep the most rows seen (and more, while the labels laid out against the values at that height need more), never the labels of another height
  let rows = vlineRows(band, plotL, plotR, plotTOf(0), S, widthOf, []).rows, vrows = rowsAt(rows), most = Math.max(rows, vrows.rows);
  for (let n = 0; n < 3 && vrows.rows !== rows; n++) { rows = vrows.rows; vrows = rowsAt(rows); most = Math.max(most, vrows.rows); }
  if (vrows.rows !== rows) for (rows = most, vrows = rowsAt(rows); vrows.rows > rows; vrows = rowsAt(rows)) rows = vrows.rows;
  // the margins hold the value labels / top tick label above and the category labels below; none of them, none of the margin
  const plotT = plotTOf(rows);
  if (plotR - plotL < (f.axis || f.labels !== 'none' ? 80 : 20) || plotB - plotT < (f.axis || f.showValues ? 80 : 20)) throw new Error('bars(): the figure is too small; raise width / height');
  const out: LaidOutBars = {type: 'bars', id: band.id, x, y, w, h, dir: 'v', stack: band.stack, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), bars: [], ticks: [], texts: [], labelBoxes: [], anchors: []};
  const yOf = (v: number) => plotB - v / band.max * (plotB - plotT);
  for (const t of ticks) {
    const ty = yOf(t.at);
    if (f.grid && (f.baseline || t.at !== 0)) out.ticks.push({x1: plotL - TICK, y1: ty, x2: plotR, y2: ty});
    else out.ticks.push({x1: plotL - TICK, y1: ty, x2: plotL, y2: ty});
    putText(out, S, t.label, plotL - TICK - 4, ty + (band.labelRole ? S * 5 / 14 : 5), 'end', 'muted', widthOf);
  }
  if (band.stack) {
    const bw = Math.min(72, (plotR - plotL) * .35), bx = (plotL + plotR - bw) / 2;
    let bottom = plotB;
    band.data.forEach((d, i) => {
      const rawH = d.value / band.max * (plotB - plotT), bh = Math.max(0, rawH - (i > 0 ? STACK_GAP : 0));
      const r = {x: bx, y: bottom - rawH, w: bw, h: bh, fill: series(d), id: d.id};
      addBar(out, d, r);
      const bar = out.bars.length - 1;
      const text = segmentOf(d, band, f.labels);
      const tw = textWidth(widthOf, text, S, 700);
      if (text && bh >= S + 10 && bw >= tw + 12) putText(out, S, text, bx + bw / 2, r.y + bh / 2 + S * .36, 'middle', 'bg', widthOf, true, r.fill, bar);
      // a segment too small for its label: the label goes beside the column (above it would sit inside the next segment)
      else if (text) putText(out, S, text, bx + bw + 8, r.y + bh / 2 + S * .36, 'start', r.fill, widthOf, true, undefined, bar);
      bottom -= rawH;
    });
  } else {
    const values = f.showValues ? verticalValues(band, plotL, plotR, plotT, plotB, S, widthOf, slots, slot, bw, yOf) : [];
    band.data.forEach((d, i) => {
      const bh = d.value / band.max * (plotB - plotT), bx = plotL + must(slots[i]) * slot + (slot - bw) / 2;
      const r = addBar(out, d, {x: bx, y: plotB - bh, w: bw, h: bh});
      const bar = out.bars.length - 1;
      if (f.showCats && !band.edges) putText(out, S, d.label, bx + bw / 2, plotB + S + 10, 'middle', 'text', widthOf, false, undefined, bar);
      const pick = values[i];
      if (!pick) return;
      const text = valueText(d, band);
      if (pick.inside) putText(out, S, text, pick.cx, pick.base, 'middle', 'bg', widthOf, true, r.fill, bar);
      else putText(out, S, text, pick.cx, pick.base, 'middle', r.fill, widthOf, true, undefined, bar);
    });
  }
  if (f.axis) out.ticks.push({x1: plotL, y1: plotT, x2: plotL, y2: plotB});
  if (f.baseline) out.ticks.push({x1: plotL, y1: plotB, x2: plotR, y2: plotB});
  overlays(out, band, {plotL, plotR, plotT, plotB, S, widthOf, yOf, vrows});
  return out;
}

/** Reference lines, edge labels, the cumulative line (with its 0-100% axis) and the curve of a vertical bars(). */
function overlays(out: LaidOutBars, band: BarsBand, g: {plotL: number; plotR: number; plotT: number; plotB: number; S: number; widthOf: WidthOf; yOf: (v: number) => number; vrows: ReturnType<typeof vlineRows>}): void {
  const {plotL, plotR, plotT, plotB, S, widthOf, yOf, vrows} = g;
  const ink: BarsInk = {lines: [], polylines: [], dots: []};
  const count = slotsOf(band.data).count, slot = (plotR - plotL) / count, xOf = (at: number) => plotL + at * slot;
  const hy: number[] = []; // where the labels of the horizontal lines already are
  for (const l of [...band.lines ?? []].sort((a, b) => b.at - a.at)) {
    const ly = yOf(l.at), fill = LINE_TONE[l.tone ?? 'danger'];
    ink.lines.push({x1: plotL, y1: ly, x2: plotR, y2: ly, fill, dashed: l.dashed !== false});
    if (!l.label) continue;
    // a label closer than its height to the one before goes to the other end of its line (right, then left)
    const near = hy.filter(y => Math.abs(y - ly) < S + 6).length;
    hy.push(ly);
    if (near % 2 === 0) putText(out, S, l.label, plotR - 4, ly - 5, 'end', fill, widthOf, true);
    else putText(out, S, l.label, plotL + 4, ly - 5, 'start', fill, widthOf, true);
  }
  for (const [i, l] of (band.vlines ?? []).entries()) {
    const lx = xOf(l.at), fill = LINE_TONE[l.tone ?? 'danger'], at = vrows.at[i];
    ink.lines.push({x1: lx, y1: plotT - 4, x2: lx, y2: plotB, fill, dashed: l.dashed !== false});
    // a label on a higher row is reached by a leader (it may pass the labels of the rows below)
    if (at && at.row > 0) ink.lines.push({x1: lx, y1: plotT - 4 - at.row * (S + 4), x2: lx, y2: plotT - 4, fill, dashed: l.dashed !== false, soft: true});
    if (l.label && at) putText(out, S, l.label, at.x, plotT - 8 - at.row * (S + 4), at.anchor, fill, widthOf, true);
  }
  if (band.edges) band.edges.forEach((e, i) => { if (e) putText(out, S, e, xOf(i), plotB + S + 10, 'middle', 'text', widthOf); });
  if (band.curve) ink.polylines.push({pts: band.curve.through.map(([sx, v]) => ({x: xOf(sx), y: yOf(v)})), fill: LINE_TONE[band.curve.tone ?? 'text'], dashed: band.curve.dashed === true, soft: true});
  if (band.cumulative) {
    const cum = cumulativeOf(band.data), yPct = (p: number) => plotB - p / 100 * (plotB - plotT);
    ink.lines.push({x1: plotR, y1: plotT, x2: plotR, y2: plotB, fill: 'border', dashed: false});
    for (const p of CUM_TICKS) {
      ink.lines.push({x1: plotR, y1: yPct(p), x2: plotR + TICK, y2: yPct(p), fill: 'border', dashed: false});
      putText(out, S, `${p}%`, plotR + TICK + 4, yPct(p) + (band.labelRole ? S * 5 / 14 : 5), 'start', 'muted', widthOf);
    }
    if (band.cumulative.guide !== undefined) ink.lines.push({x1: plotL, y1: yPct(band.cumulative.guide), x2: plotR, y2: yPct(band.cumulative.guide), fill: 'muted', dashed: true});
    // the textbook line: from the origin, through the upper right corner of each bar
    const pts = [{x: plotL, y: plotB}, ...cum.map((p, i) => ({x: xOf(i + 1), y: yPct(p)}))];
    ink.polylines.push({pts, fill: 'danger', dashed: false});
    // each percent sits at the first of four places that touches neither another label nor a line (the line, the guide, the bars' own values)
    const segs = [...ink.lines.filter(l => !l.soft), ...ink.polylines.filter(l => !l.soft).flatMap(l => l.pts.slice(1).map((q, k) => ({x1: must(l.pts[k]).x, y1: must(l.pts[k]).y, x2: q.x, y2: q.y})))];
    for (const [i, p] of pts.slice(1).entries()) {
      ink.dots.push({x: p.x, y: p.y, fill: 'danger'});
      const text = cumText(must(cum[i])), tw = textWidth(widthOf, text, S, 700);
      const places: ['start' | 'middle' | 'end', number, number][] = [['end', p.x - 6, p.y - 7], ['middle', p.x, p.y - 12], ['start', p.x + 6, p.y - 7], ['end', p.x - 6, p.y + S + 4], ['start', p.x + 6, p.y + S + 4]];
      const boxOf = (a: 'start' | 'middle' | 'end', lx: number, ly: number) => ({x: a === 'middle' ? lx - tw / 2 : a === 'end' ? lx - tw : lx, y: ly - S, w: tw, h: S + 4});
      const clear = (b: {x: number; y: number; w: number; h: number}): boolean => b.x >= out.x && b.x + b.w <= out.x + out.w && b.y >= out.y && !out.labelBoxes.some(o => hitRect(b, o)) && !segs.some(sg => segHitsRect(sg, b));
      const at = places.find(([a, lx, ly]) => clear(boxOf(a, lx, ly))) ?? must(places[0]);
      putText(out, S, text, at[1], at[2], at[0], 'danger', widthOf, true);
    }
  }
  if (ink.lines.length || ink.polylines.length || ink.dots.length) out.ink = ink;
}
