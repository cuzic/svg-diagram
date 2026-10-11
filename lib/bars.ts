import {textWidth} from './measure.ts';
import {ticksOf} from './plane.ts';
import {ROLES} from './tokens.ts';
import type {BarDatum, BarsBand, ColorKey, FontFamily, LaidOutBars, WidthOf} from './types.ts';

const SERIES: Record<NonNullable<BarDatum['series']>, ColorKey> = {a: 'accent', b: 'text', c: 'muted'};
const AXIS = 2, TICK = 6, BAR = 28, GAP = 18, STACK_GAP = 2;

const valueText = (d: BarDatum, unit = '') => `${d.value}${unit}`;
const segmentText = (d: BarDatum, unit = '') => `${d.label} ${valueText(d, unit)}`;

/** Every string bars() draws, registered before its geometry is calculated. */
export function barsTexts(band: BarsBand): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const d of band.data) {
    out.push([d.label, ROLES.note, 400, 'sans']);
    out.push([valueText(d, band.unit), ROLES.note, 700, 'sans']);
    if (band.stack) out.push([segmentText(d, band.unit), ROLES.note, 700, 'sans']);
  }
  for (const t of ticksOf({max: band.max})) out.push([t.label, ROLES.note, 400, 'sans']);
  return out;
}

function putText(
  out: LaidOutBars, text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end', fill: ColorKey,
  widthOf: WidthOf, bold = false, check = false,
): void {
  out.texts.push({text, x, y, anchor, fill, size: ROLES.note, bold});
  if (!check) return;
  const w = textWidth(widthOf, text, ROLES.note, bold ? 700 : 400);
  out.labelBoxes.push({label: text, x: anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x, y: y - ROLES.note, w, h: ROLES.note + 4});
}

export function layoutBars(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutBars {
  return band.dir === 'v' ? layoutVertical(band, x, y, w, widthOf) : layoutHorizontal(band, x, y, w, widthOf);
}

function layoutHorizontal(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutBars {
  const rows = band.stack ? 1 : band.data.length;
  const tickH = ROLES.note + TICK + 8;
  const h = band.height ?? rows * BAR + Math.max(0, rows - 1) * GAP + tickH + 8;
  const labelW = band.stack ? 0 : Math.max(...band.data.map(d => textWidth(widthOf, d.label, ROLES.note, 400))) + 12;
  const valueW = Math.max(...band.data.map(d => textWidth(widthOf, valueText(d, band.unit), ROLES.note, 700))) + 12;
  const plotL = x + labelW, plotR = x + w - valueW, plotW = plotR - plotL;
  if (plotW < 80) throw new Error('bars(): the figure is too narrow for its labels');
  const out: LaidOutBars = {type: 'bars', x, y, w, h, dir: 'h', stack: band.stack, bars: [], ticks: [], texts: [], labelBoxes: [], anchors: []};
  const axisY = y + rows * BAR + Math.max(0, rows - 1) * GAP;
  for (const t of ticksOf({max: band.max})) {
    const tx = plotL + t.at / band.max * plotW;
    out.ticks.push({x1: tx, y1: y, x2: tx, y2: axisY + TICK});
    putText(out, t.label, tx, axisY + TICK + ROLES.note + 2, 'middle', 'muted', widthOf);
  }
  if (band.stack) {
    let at = plotL;
    band.data.forEach((d, i) => {
      const rawW = d.value / band.max * plotW, bw = Math.max(0, rawW - (i < band.data.length - 1 ? STACK_GAP : 0));
      const r = {x: at, y, w: bw, h: BAR, fill: SERIES[d.series ?? 'a'], id: d.id};
      out.bars.push(r); if (d.id) out.anchors.push({...r, id: d.id});
      const text = segmentText(d, band.unit), tw = textWidth(widthOf, text, ROLES.note, 700);
      if (bw >= tw + 12) putText(out, text, r.x + r.w / 2, r.y + BAR / 2 + ROLES.note * .36, 'middle', 'bg', widthOf, true, true);
      else putText(out, text, r.x + r.w / 2, r.y + BAR + ROLES.note + 4, 'middle', SERIES[d.series ?? 'a'], widthOf, true, true);
      at += rawW;
    });
  } else band.data.forEach((d, i) => {
    const by = y + i * (BAR + GAP), bw = d.value / band.max * plotW;
    const r = {x: plotL, y: by, w: bw, h: BAR, fill: SERIES[d.series ?? 'a'], id: d.id};
    out.bars.push(r); if (d.id) out.anchors.push({...r, id: d.id});
    putText(out, d.label, plotL - 8, by + BAR / 2 + ROLES.note * .36, 'end', 'text', widthOf);
    const text = valueText(d, band.unit), tw = textWidth(widthOf, text, ROLES.note, 700);
    if (bw >= tw + 12) putText(out, text, plotL + bw - 6, by + BAR / 2 + ROLES.note * .36, 'end', 'bg', widthOf, true, true);
    else putText(out, text, plotL + bw + 6, by + BAR / 2 + ROLES.note * .36, 'start', SERIES[d.series ?? 'a'], widthOf, true, true);
  });
  out.ticks.push({x1: plotL, y1: axisY, x2: plotR, y2: axisY});
  return out;
}

function layoutVertical(band: BarsBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutBars {
  const h = band.height ?? 280;
  const ticks = ticksOf({max: band.max});
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
      const rawH = d.value / band.max * (plotB - plotT), bh = Math.max(0, rawH - (i < band.data.length - 1 ? STACK_GAP : 0));
      const r = {x: bx, y: bottom - rawH, w: bw, h: bh, fill: SERIES[d.series ?? 'a'], id: d.id};
      out.bars.push(r); if (d.id) out.anchors.push({...r, id: d.id});
      const text = segmentText(d, band.unit);
      if (bh >= ROLES.note + 10) putText(out, text, bx + bw / 2, r.y + bh / 2 + ROLES.note * .36, 'middle', 'bg', widthOf, true, true);
      else putText(out, text, bx + bw + 6, r.y + bh / 2 + ROLES.note * .36, 'start', SERIES[d.series ?? 'a'], widthOf, true, true);
      bottom -= rawH;
    });
  } else {
    const slot = (plotR - plotL) / band.data.length, bw = Math.min(64, slot * .62);
    band.data.forEach((d, i) => {
      const bh = d.value / band.max * (plotB - plotT), bx = plotL + i * slot + (slot - bw) / 2;
      const r = {x: bx, y: plotB - bh, w: bw, h: bh, fill: SERIES[d.series ?? 'a'], id: d.id};
      out.bars.push(r); if (d.id) out.anchors.push({...r, id: d.id});
      putText(out, d.label, bx + bw / 2, plotB + ROLES.note + 8, 'middle', 'text', widthOf);
      const text = valueText(d, band.unit);
      if (bh >= ROLES.note + 10) putText(out, text, bx + bw / 2, r.y + ROLES.note + 4, 'middle', 'bg', widthOf, true, true);
      else putText(out, text, bx + bw / 2, r.y - 6, 'middle', SERIES[d.series ?? 'a'], widthOf, true, true);
    });
  }
  out.ticks.push({x1: plotL, y1: plotT, x2: plotL, y2: plotB}, {x1: plotL, y1: plotB, x2: plotR, y2: plotB});
  return out;
}
