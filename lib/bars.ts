import {textWidth} from './atoms.ts';
import {fmt, ticksOf} from './plane.ts';
import type {BarDatum, BarsBand, BarsInk, BarsLine, ColorKey, FontFamily, LaidOutBars, WidthOf, Roles} from './types.ts';

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

const valueText = (d: BarDatum, unit = '') => `${fmt(d.value)}${unit}`;

/** What a bars() band shows; every default is the original look. */
function flags(band: BarsBand) {
  const labels = band.labels ?? 'all', axis = band.axis !== false;
  return {showValues: labels === 'all', showCats: labels !== 'none', axis, grid: band.grid ?? (axis && !band.cumulative), baseline: band.baseline !== false, labels};
}
/** Values are on neither a label nor a scale: the figure alone cannot be read for them. */
export const barsValuesHidden = (band: BarsBand): boolean => band.labels !== undefined && band.labels !== 'all' && band.axis === false;
/** Text inside / beside a stacked segment: label and value, or what labels: leaves of them. */
const segmentOf = (d: BarDatum, unit: string | undefined, labels: 'all' | 'category' | 'none') =>
  labels === 'all' ? `${d.label} ${valueText(d, unit)}` : labels === 'category' ? d.label : '';
const segmentText = (d: BarDatum, unit = '') => segmentOf(d, unit, 'all');
const series = (d: BarDatum): ColorKey => d.tone ?? SERIES[d.series ?? 'a'];

/** Every string bars() draws, registered before its geometry is calculated. */
export function barsTexts(band: BarsBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  const f = flags(band), S = sizeOf(band, roles);
  for (const d of band.data) {
    if (f.showCats) out.push([d.label, S, 400, 'sans']);
    if (f.showValues) out.push([valueText(d, band.unit), S, 700, 'sans']);
    const seg = segmentOf(d, band.unit, f.labels);
    if (band.stack && seg) out.push([seg, S, 700, 'sans']);
  }
  if (f.axis) for (const t of ticksOf({max: band.max}, 'bars')) out.push([t.label, S, 400, 'sans']);
  for (const l of [...band.lines ?? [], ...band.vlines ?? []]) if (l.label) out.push([l.label, S, 700, 'sans']);
  for (const e of band.edges ?? []) out.push([e, S, 400, 'sans']);
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
function vlineRows(band: BarsBand, plotL: number, plotR: number, S: number, widthOf: WidthOf): {rows: number; at: ({x: number; anchor: 'start' | 'middle' | 'end'; row: number} | undefined)[]} {
  const count = slotsOf(band.data).count, slot = (plotR - plotL) / count;
  const placed: {x1: number; x2: number; row: number}[] = [];
  const at = (band.vlines ?? []).map(l => {
    if (!l.label) return undefined;
    const lx = plotL + l.at * slot, tw = textWidth(widthOf, l.label, S, 700);
    const anchor = lx - tw / 2 < plotL + 2 ? 'start' : lx + tw / 2 > plotR - 2 ? 'end' : 'middle';
    const x = anchor === 'start' ? lx + 4 : anchor === 'end' ? lx - 4 : lx, x1 = anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2;
    let row = 0;
    while (placed.some(p => p.row === row && x1 < p.x2 + 6 && p.x1 < x1 + tw + 6)) row++;
    placed.push({x1, x2: x1 + tw, row});
    return {x, anchor: anchor as 'start' | 'middle' | 'end', row};
  });
  return {rows: at.reduce((n, a) => a ? Math.max(n, a.row + 1) : n, 0), at};
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
  out.texts.push({text, x, y, anchor, fill, size: S, bold, reveal: bar === undefined ? undefined : out.bars[bar].reveal, ...(bar === undefined || out.bars[bar].until === undefined ? {} : {until: out.bars[bar].until}), bar});
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
    slots.push(slot ?? count++);
    if (d.id) at.set(d.id, slots[slots.length - 1]);
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
  const valueW = band.stack || !f.showValues ? 0 : Math.max(...band.data.map(d => textWidth(widthOf, valueText(d, band.unit), S, 700))) + 12;
  const tickPadL = band.stack && f.axis ? textWidth(widthOf, ticks[0].label, S, 400) / 2 : 0;
  const tickPadR = band.stack && f.axis ? textWidth(widthOf, ticks[ticks.length - 1].label, S, 400) / 2 : 0;
  const plotL = x + labelW + tickPadL, plotR = x + w - valueW - tickPadR, plotW = plotR - plotL;
  if (plotW < (f.axis || f.labels !== 'none' ? 80 : 20)) throw new Error('bars(): the figure is too narrow for its labels');
  const segs = band.data.map(d => segmentOf(d, band.unit, f.labels));
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
      const text = segs[i], tw = textWidth(widthOf, text, S, 700);
      if (text && bw >= tw + 12) putText(out, S, text, r.x + r.w / 2, r.y + BARH / 2 + S * .36, 'middle', 'bg', widthOf, true, r.fill, bar);
      else if (text) putText(out, S, text, r.x + r.w / 2, r.y + BARH + S + 4, 'middle', r.fill, widthOf, true, undefined, bar);
      at += rawW;
    });
  } else band.data.forEach((d, i) => {
    const by = y + slots[i] * (bh + gp), bw = d.value / band.max * plotW;
    const r = addBar(out, d, {x: plotL, y: by, w: bw, h: bh});
    const bar = out.bars.length - 1;
    if (f.showCats) putText(out, S, d.label, plotL - 8, by + bh / 2 + S * .36, 'end', 'text', widthOf, false, undefined, bar);
    if (!f.showValues) return;
    const text = valueText(d, band.unit), tw = textWidth(widthOf, text, S, 700);
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
  if (f.axis && band.cumulative && band.max - ticks[ticks.length - 1].at > band.max * 0.08) ticks.push({at: band.max, label: fmt(band.max)});
  const tickW = Math.max(0, ...ticks.map(t => textWidth(widthOf, t.label, S, 400)));
  const cumW = band.cumulative ? Math.max(...CUM_TICKS.map(p => textWidth(widthOf, `${p}%`, S, 400))) + TICK + 10 : 0;
  // the edge labels are centred on the edges, so the first and the last stick out half their width
  const edgeHalf = (i: number) => band.edges ? textWidth(widthOf, band.edges[i], S, 400) / 2 : 0;
  const plotL = Math.max(x + (f.axis ? tickW + TICK + 10 : 4), x + edgeHalf(0)), plotR = Math.min(x + w - (band.cumulative ? cumW : 8), x + w - edgeHalf(band.edges ? band.edges.length - 1 : 0) - 2);
  // the labels of the vertical reference lines stand on rows above the plot; one that would touch its neighbour goes a row higher
  const vrows = vlineRows(band, plotL, plotR, S, widthOf);
  const topLabels = [...band.lines ?? []].some(l => l.label) || vrows.rows > 0;
  // the margins hold the value labels / top tick label above and the category labels below; none of them, none of the margin
  const plotT = y + (f.axis || f.showValues || topLabels || band.cumulative ? S + 8 : 4) + Math.max(0, vrows.rows - 1) * (S + 4), plotB = f.showCats || band.edges ? y + h - S * 1.4 - 14 : y + h - 4;
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
      const text = segmentOf(d, band.unit, f.labels);
      const tw = textWidth(widthOf, text, S, 700);
      if (text && bh >= S + 10 && bw >= tw + 12) putText(out, S, text, bx + bw / 2, r.y + bh / 2 + S * .36, 'middle', 'bg', widthOf, true, r.fill, bar);
      // a segment too small for its label: the label goes beside the column (above it would sit inside the next segment)
      else if (text) putText(out, S, text, bx + bw + 8, r.y + bh / 2 + S * .36, 'start', r.fill, widthOf, true, undefined, bar);
      bottom -= rawH;
    });
  } else {
    // barRatio (when given) is the bar's share of its slot with no upper limit; 1 makes neighbours touch
    const {slots, count} = slotsOf(band.data);
    const slot = (plotR - plotL) / count, bw = band.barRatio === undefined ? Math.min(64, slot * .62) : slot * band.barRatio;
    band.data.forEach((d, i) => {
      const bh = d.value / band.max * (plotB - plotT), bx = plotL + slots[i] * slot + (slot - bw) / 2;
      const r = addBar(out, d, {x: bx, y: plotB - bh, w: bw, h: bh});
      const bar = out.bars.length - 1;
      if (f.showCats && !band.edges) putText(out, S, d.label, bx + bw / 2, plotB + S + 10, 'middle', 'text', widthOf, false, undefined, bar);
      if (!f.showValues) return;
      const text = valueText(d, band.unit);
      const tw = textWidth(widthOf, text, S, 700);
      if (bh >= S + 10 && bw >= tw + 12) putText(out, S, text, bx + bw / 2, r.y + S + 4, 'middle', 'bg', widthOf, true, r.fill, bar);
      else putText(out, S, text, bx + bw / 2, r.y - 6, 'middle', r.fill, widthOf, true, undefined, bar);
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
  for (const l of band.lines ?? []) {
    const ly = yOf(l.at), fill = LINE_TONE[l.tone ?? 'danger'];
    ink.lines.push({x1: plotL, y1: ly, x2: plotR, y2: ly, fill, dashed: l.dashed !== false});
    if (l.label) putText(out, S, l.label, plotR - 4, ly - 5, 'end', fill, widthOf, true);
  }
  for (const [i, l] of (band.vlines ?? []).entries()) {
    const lx = xOf(l.at), fill = LINE_TONE[l.tone ?? 'danger'], at = vrows.at[i];
    ink.lines.push({x1: lx, y1: plotT - 4 - (at ? at.row * (S + 4) : 0), x2: lx, y2: plotB, fill, dashed: l.dashed !== false});
    if (l.label && at) putText(out, S, l.label, at.x, plotT - 8 - at.row * (S + 4), at.anchor, fill, widthOf, true);
  }
  if (band.edges) band.edges.forEach((e, i) => putText(out, S, e, xOf(i), plotB + S + 10, 'middle', 'text', widthOf));
  if (band.curve) ink.polylines.push({pts: band.curve.through.map(([sx, v]) => ({x: xOf(sx), y: yOf(v)})), fill: LINE_TONE[band.curve.tone ?? 'text'], dashed: band.curve.dashed === true});
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
    for (const [i, p] of pts.slice(1).entries()) {
      ink.dots.push({x: p.x, y: p.y, fill: 'danger'});
      putText(out, S, cumText(cum[i]), p.x - 6, p.y - 7, 'end', 'danger', widthOf, true);
    }
  }
  if (ink.lines.length || ink.polylines.length || ink.dots.length) out.ink = ink;
}
