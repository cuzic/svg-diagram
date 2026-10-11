import {textWidth} from './measure.ts';
import {fmt, ticksOf} from './plane.ts';
import {ROLES} from './tokens.ts';
import type {BarDatum, BarsBand, ColorKey, FontFamily, LaidOutBars, WidthOf} from './types.ts';

const SERIES: Record<NonNullable<BarDatum['series']>, ColorKey> = {a: 'accent', b: 'text', c: 'muted'};
const TICK = 6, BAR = 28, GAP = 18, STACK_GAP = 2;

const valueText = (d: BarDatum, unit = '') => `${fmt(d.value)}${unit}`;
const segmentText = (d: BarDatum, unit = '') => `${d.label} ${valueText(d, unit)}`;
const series = (d: BarDatum): ColorKey => SERIES[d.series ?? 'a'];

/** Every string bars() draws, registered before its geometry is calculated. */
export function barsTexts(band: BarsBand): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const d of band.data) {
    out.push([d.label, ROLES.note, 400, 'sans']);
    out.push([valueText(d, band.unit), ROLES.note, 700, 'sans']);
    if (band.stack) out.push([segmentText(d, band.unit), ROLES.note, 700, 'sans']);
  }
  for (const t of ticksOf({max: band.max}, 'bars')) out.push([t.label, ROLES.note, 400, 'sans']);
  return out;
}

function putText(
  out: LaidOutBars, text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end', fill: ColorKey,
  widthOf: WidthOf, bold = false, background?: ColorKey,
): void {
  out.texts.push({text, x, y, anchor, fill, size: ROLES.note, bold});
  const w = textWidth(widthOf, text, ROLES.note, bold ? 700 : 400);
  out.labelBoxes.push({label: text, x: anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x, y: y - ROLES.note, w, h: ROLES.note + 4, background});
}

function addBar(out: LaidOutBars, d: BarDatum, r: Omit<LaidOutBars['bars'][number], 'fill' | 'id'>): LaidOutBars['bars'][number] {
  const bar = {...r, fill: series(d), id: d.id};
  out.bars.push(bar);
  if (d.id) out.anchors.push({...bar, id: d.id});
  return bar;
}

export function layoutBars(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutBars {
  return band.dir === 'v' ? layoutVertical(band, x, y, w, widthOf) : layoutHorizontal(band, x, y, w, widthOf);
}

function layoutHorizontal(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutBars {
  const rows = band.stack ? 1 : band.data.length;
  const tickH = ROLES.note + TICK + 8;
  const ticks = ticksOf({max: band.max}, 'bars');
  const labelW = band.stack ? 0 : Math.max(...band.data.map(d => textWidth(widthOf, d.label, ROLES.note, 400))) + 12;
  const valueW = band.stack ? 0 : Math.max(...band.data.map(d => textWidth(widthOf, valueText(d, band.unit), ROLES.note, 700))) + 12;
  const tickPadL = band.stack ? textWidth(widthOf, ticks[0].label, ROLES.note, 400) / 2 : 0;
  const tickPadR = band.stack ? textWidth(widthOf, ticks[ticks.length - 1].label, ROLES.note, 400) / 2 : 0;
  const plotL = x + labelW + tickPadL, plotR = x + w - valueW - tickPadR, plotW = plotR - plotL;
  if (plotW < 80) throw new Error('bars(): the figure is too narrow for its labels');
  const hasOutside = band.stack && band.data.some(d => d.value / band.max * plotW < textWidth(widthOf, segmentText(d, band.unit), ROLES.note, 700) + 12);
  const outsideH = hasOutside ? ROLES.note + 6 : 0;
  const needH = rows * BAR + Math.max(0, rows - 1) * GAP + tickH + 8 + outsideH;
  if (band.height !== undefined && band.height < needH) throw new Error(`bars(): height ${band.height} is too small for its content (need at least ${needH})`);
  const h = band.height ?? needH;
  const out: LaidOutBars = {type: 'bars', x, y, w, h, dir: 'h', stack: band.stack, bars: [], ticks: [], texts: [], labelBoxes: [], anchors: []};
  const axisY = y + rows * BAR + Math.max(0, rows - 1) * GAP;
  for (const t of ticks) {
    const tx = plotL + t.at / band.max * plotW;
    out.ticks.push({x1: tx, y1: y, x2: tx, y2: axisY + TICK});
    putText(out, t.label, tx, axisY + outsideH + TICK + ROLES.note + 2, 'middle', 'muted', widthOf);
  }
  if (band.stack) {
    let at = plotL;
    band.data.forEach((d, i) => {
      const rawW = d.value / band.max * plotW, bw = Math.max(0, rawW - (i < band.data.length - 1 ? STACK_GAP : 0));
      const r = addBar(out, d, {x: at, y, w: bw, h: BAR});
      const text = segmentText(d, band.unit), tw = textWidth(widthOf, text, ROLES.note, 700);
      if (bw >= tw + 12) putText(out, text, r.x + r.w / 2, r.y + BAR / 2 + ROLES.note * .36, 'middle', 'bg', widthOf, true, r.fill);
      else putText(out, text, r.x + r.w / 2, r.y + BAR + ROLES.note + 4, 'middle', r.fill, widthOf, true);
      at += rawW;
    });
  } else band.data.forEach((d, i) => {
    const by = y + i * (BAR + GAP), bw = d.value / band.max * plotW;
    const r = addBar(out, d, {x: plotL, y: by, w: bw, h: BAR});
    putText(out, d.label, plotL - 8, by + BAR / 2 + ROLES.note * .36, 'end', 'text', widthOf);
    const text = valueText(d, band.unit), tw = textWidth(widthOf, text, ROLES.note, 700);
    if (bw >= tw + 12) putText(out, text, plotL + bw - 6, by + BAR / 2 + ROLES.note * .36, 'end', 'bg', widthOf, true, r.fill);
    else putText(out, text, plotL + bw + 6, by + BAR / 2 + ROLES.note * .36, 'start', r.fill, widthOf, true);
  });
  out.ticks.push({x1: plotL, y1: axisY, x2: plotR, y2: axisY});
  return out;
}

function layoutVertical(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutBars {
  const h = band.height ?? 280;
  const ticks = ticksOf({max: band.max}, 'bars');
  const tickW = Math.max(...ticks.map(t => textWidth(widthOf, t.label, ROLES.note, 400)));
  const plotL = x + tickW + TICK + 10, plotR = x + w - 8;
  const plotT = y + ROLES.note + 8, plotB = y + h - ROLES.note * 1.4 - 14;
  if (plotR - plotL < 80 || plotB - plotT < 80) throw new Error('bars(): the figure is too small; raise width / height');
  const out: LaidOutBars = {type: 'bars', x, y, w, h, dir: 'v', stack: band.stack, bars: [], ticks: [], texts: [], labelBoxes: [], anchors: []};
  for (const t of ticks) {
    const ty = plotB - t.at / band.max * (plotB - plotT);
    out.ticks.push({x1: plotL - TICK, y1: ty, x2: plotR, y2: ty});
    putText(out, t.label, plotL - TICK - 4, ty + 5, 'end', 'muted', widthOf);
  }
  if (band.stack) {
    const bw = Math.min(72, (plotR - plotL) * .35), bx = (plotL + plotR - bw) / 2;
    let bottom = plotB;
    band.data.forEach((d, i) => {
      const rawH = d.value / band.max * (plotB - plotT), bh = Math.max(0, rawH - (i > 0 ? STACK_GAP : 0));
      const r = {x: bx, y: bottom - rawH, w: bw, h: bh, fill: SERIES[d.series ?? 'a'], id: d.id};
      addBar(out, d, r);
      const text = segmentText(d, band.unit);
      const tw = textWidth(widthOf, text, ROLES.note, 700);
      if (bh >= ROLES.note + 10 && bw >= tw + 12) putText(out, text, bx + bw / 2, r.y + bh / 2 + ROLES.note * .36, 'middle', 'bg', widthOf, true, r.fill);
      else putText(out, text, bx + bw / 2, r.y - 6, 'middle', r.fill, widthOf, true);
      bottom -= rawH;
    });
  } else {
    const slot = (plotR - plotL) / band.data.length, bw = Math.min(64, slot * .62);
    band.data.forEach((d, i) => {
      const bh = d.value / band.max * (plotB - plotT), bx = plotL + i * slot + (slot - bw) / 2;
      const r = addBar(out, d, {x: bx, y: plotB - bh, w: bw, h: bh});
      putText(out, d.label, bx + bw / 2, plotB + ROLES.note + 10, 'middle', 'text', widthOf);
      const text = valueText(d, band.unit);
      const tw = textWidth(widthOf, text, ROLES.note, 700);
      if (bh >= ROLES.note + 10 && bw >= tw + 12) putText(out, text, bx + bw / 2, r.y + ROLES.note + 4, 'middle', 'bg', widthOf, true, r.fill);
      else putText(out, text, bx + bw / 2, r.y - 6, 'middle', r.fill, widthOf, true);
    });
  }
  out.ticks.push({x1: plotL, y1: plotT, x2: plotL, y2: plotB}, {x1: plotL, y1: plotB, x2: plotR, y2: plotB});
  return out;
}
