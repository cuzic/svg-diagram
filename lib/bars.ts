import {textWidth} from './atoms.ts';
import {fmt, ticksOf} from './plane.ts';
import type {BarDatum, BarsBand, ColorKey, FontFamily, LaidOutBars, WidthOf, Roles} from './types.ts';

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
  return {showValues: labels === 'all', showCats: labels !== 'none', axis, grid: band.grid ?? axis, baseline: band.baseline !== false, labels};
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
  return out;
}

function putText(
  out: LaidOutBars, S: number, text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end', fill: ColorKey,
  widthOf: WidthOf, bold = false, background?: ColorKey, bar?: number,
): void {
  out.texts.push({text, x, y, anchor, fill, size: S, bold, reveal: bar === undefined ? undefined : out.bars[bar].reveal, bar});
  const w = textWidth(widthOf, text, S, bold ? 700 : 400);
  out.labelBoxes.push({label: text, x: anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x, y: y - S, w, h: S + 4, background, bar});
}

function addBar(out: LaidOutBars, d: BarDatum, r: Omit<LaidOutBars['bars'][number], 'fill' | 'id'>): LaidOutBars['bars'][number] {
  const bar = {...r, fill: series(d), id: d.id, reveal: d.reveal};
  out.bars.push(bar);
  if (d.id) out.anchors.push({...bar, id: d.id});
  return bar;
}

export function layoutBars(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutBars {
  return band.dir === 'v' ? layoutVertical(band, x, y, w, widthOf, roles) : layoutHorizontal(band, x, y, w, widthOf, roles);
}

function layoutHorizontal(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutBars {
  const f = flags(band), S = sizeOf(band, roles), BARH = barH(band, S);
  const rows = band.stack ? 1 : band.data.length;
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
  const out: LaidOutBars = {type: 'bars', id: band.id, x, y, w, h, dir: 'h', stack: band.stack, reveal: band.reveal, bars: [], ticks: [], texts: [], labelBoxes: [], anchors: []};
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
    const by = y + i * (bh + gp), bw = d.value / band.max * plotW;
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
  const tickW = Math.max(0, ...ticks.map(t => textWidth(widthOf, t.label, S, 400)));
  const plotL = x + (f.axis ? tickW + TICK + 10 : 4), plotR = x + w - 8;
  // the margins hold the value labels / top tick label above and the category labels below; none of them, none of the margin
  const plotT = y + (f.axis || f.showValues ? S + 8 : 4), plotB = f.showCats ? y + h - S * 1.4 - 14 : y + h - 4;
  if (plotR - plotL < (f.axis || f.labels !== 'none' ? 80 : 20) || plotB - plotT < (f.axis || f.showValues ? 80 : 20)) throw new Error('bars(): the figure is too small; raise width / height');
  const out: LaidOutBars = {type: 'bars', id: band.id, x, y, w, h, dir: 'v', stack: band.stack, reveal: band.reveal, bars: [], ticks: [], texts: [], labelBoxes: [], anchors: []};
  for (const t of ticks) {
    const ty = plotB - t.at / band.max * (plotB - plotT);
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
      else if (text) putText(out, S, text, bx + bw / 2, r.y - 6, 'middle', r.fill, widthOf, true, undefined, bar);
      bottom -= rawH;
    });
  } else {
    // barRatio (when given) is the bar's share of its slot with no upper limit; 1 makes neighbours touch
    const slot = (plotR - plotL) / band.data.length, bw = band.barRatio === undefined ? Math.min(64, slot * .62) : slot * band.barRatio;
    band.data.forEach((d, i) => {
      const bh = d.value / band.max * (plotB - plotT), bx = plotL + i * slot + (slot - bw) / 2;
      const r = addBar(out, d, {x: bx, y: plotB - bh, w: bw, h: bh});
      const bar = out.bars.length - 1;
      if (f.showCats) putText(out, S, d.label, bx + bw / 2, plotB + S + 10, 'middle', 'text', widthOf, false, undefined, bar);
      if (!f.showValues) return;
      const text = valueText(d, band.unit);
      const tw = textWidth(widthOf, text, S, 700);
      if (bh >= S + 10 && bw >= tw + 12) putText(out, S, text, bx + bw / 2, r.y + S + 4, 'middle', 'bg', widthOf, true, r.fill, bar);
      else putText(out, S, text, bx + bw / 2, r.y - 6, 'middle', r.fill, widthOf, true, undefined, bar);
    });
  }
  if (f.axis) out.ticks.push({x1: plotL, y1: plotT, x2: plotL, y2: plotB});
  if (f.baseline) out.ticks.push({x1: plotL, y1: plotB, x2: plotR, y2: plotB});
  return out;
}
