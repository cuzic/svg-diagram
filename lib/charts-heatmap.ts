// heatmap(): a table of numbers whose cells are shaded by size (a cohort table, a retention table, a score matrix). The number is always
// printed in its cell; the shade is the accent at one of a few steps (a quantised ramp), so a printout in grey still reads, and the legend
// says which range each step stands for.
import {niceNear, niceUp} from './qc.ts';
import {Canvas, checkText, decimalsIn, fail, finiteNum, inkOnShade, numText, shadeOps} from './charts-base.ts';
import type {ChartGeom, ChartOpts, LaidOutChartPart} from './charts-base.ts';

export interface HeatmapOpts extends ChartOpts {
  /** Written after every number ('%', '件'). */
  unit?: string;
  /** Decimals to print (default: as many as the data has, at most 2). */
  decimals?: number;
  /** The values the lightest / the darkest step stand for (default: the smallest / the largest value). Values outside are clamped. */
  min?: number;
  max?: number;
  /** How many shades (3-6, default 5). */
  levels?: number;
  /** Row labels in the table's row-heading style: bold, with a rule after them (default true). */
  rowHeader?: boolean;
  /** The text of the top-left corner (the name of the rows and of the columns: '登録月 ＼ 経過月'). */
  corner?: string;
  /** The legend of the shades (default true). */
  scale?: boolean;
  /** Row height (default from the text size). */
  cellH?: number;
}
export interface HeatmapSpec {rows: string[]; cols: string[]; values: (number | null)[][]; unit: string; decimals: number; min: number; max: number; levels: number; rowHeader: boolean; corner: string; scale: boolean; cellH?: number}

export function resolveHeatmap(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts: HeatmapOpts): HeatmapSpec {
  if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(cols) || cols.length === 0) fail('heatmap', 'needs at least one row and one column');
  if (rows.length > 40 || cols.length > 24) fail('heatmap', `${rows.length} rows x ${cols.length} columns is too large for one figure (at most 40 x 24)`);
  rows.forEach((r, i) => checkText('heatmap', `row ${i + 1}'s label`, r)); cols.forEach((r, i) => checkText('heatmap', `column ${i + 1}'s label`, r));
  if (values.length !== rows.length) fail('heatmap', `values has ${values.length} rows for ${rows.length} row labels`);
  values.forEach((r, i) => { if (!Array.isArray(r) || r.length !== cols.length) fail('heatmap', `row "${rows[i]}" has ${Array.isArray(r) ? r.length : 0} values for ${cols.length} columns (use null for an empty cell)`); });
  const flat = values.flat().map((v, k) => v === null ? null : finiteNum('heatmap', `the value of "${rows[Math.floor(k / cols.length)]}" x "${cols[k % cols.length]}"`, v));
  const real = flat.filter((v): v is number => v !== null);
  if (!real.length) fail('heatmap', 'every cell is null: there is nothing to show');
  let levels = opts.levels ?? 5;
  if (!(Number.isInteger(levels) && levels >= 3 && levels <= 6)) fail('heatmap', `levels must be a whole number from 3 to 6 (got ${levels})`);
  let min = opts.min ?? Math.min(...real), max = opts.max ?? Math.max(...real);
  if (opts.min === undefined && opts.max === undefined && max > min) {
    // the steps fall on round numbers: a step of 1, 2 or 5 x 10^k that gives at most `levels` shades (at least 3)
    let step = niceNear((max - min) / levels);
    const lo = (st: number) => Math.floor(min / st + 1e-9) * st;
    while (Math.ceil((max - lo(step)) / step - 1e-9) > 6) step = niceUp(step * 1.01);
    min = parseFloat(lo(step).toPrecision(12));
    levels = Math.max(3, Math.ceil((max - min) / step - 1e-9));
    max = parseFloat((min + levels * step).toPrecision(12));
  }
  finiteNum('heatmap', 'min', min); finiteNum('heatmap', 'max', max);
  if (max === min) max = min + 1;
  if (!(max > min)) fail('heatmap', `max (${max}) must be above min (${min})`);
  if (opts.decimals !== undefined && !(Number.isInteger(opts.decimals) && opts.decimals >= 0 && opts.decimals <= 6)) fail('heatmap', `decimals must be a whole number from 0 to 6 (got ${opts.decimals})`);
  const decimals = opts.decimals ?? Math.min(2, Math.max(0, ...real.map(decimalsIn)));
  return {rows: [...rows], cols: [...cols], values: values.map(r => [...r]), unit: opts.unit ?? '', decimals, min, max, levels, rowHeader: opts.rowHeader !== false, corner: opts.corner ?? '', scale: opts.scale !== false, ...(opts.cellH === undefined ? {} : {cellH: opts.cellH})};
}
const cellText = (v: number, s: HeatmapSpec): string => `${numText(Number(v.toFixed(s.decimals)))}${s.unit}`;
const bound = (i: number, s: HeatmapSpec): number => s.min + (s.max - s.min) * i / s.levels;
const rangeText = (i: number, s: HeatmapSpec): string => {
  const f = (v: number) => numText(parseFloat(v.toPrecision(6)));
  return i === 0 ? `〜${f(bound(1, s))}` : i === s.levels - 1 ? `${f(bound(i, s))}〜` : `${f(bound(i, s))}〜${f(bound(i + 1, s))}`;
};
export const heatLevel = (v: number, s: Pick<HeatmapSpec, 'min' | 'max' | 'levels'>): number => Math.max(0, Math.min(s.levels - 1, Math.floor((v - s.min) / (s.max - s.min) * s.levels + 1e-9)));

export function heatmapAlt(s: HeatmapSpec): string {
  const rows = s.rows.map((r, i) => `${r}: ${s.values[i].map(v => v === null ? '-' : cellText(v, s)).join(' / ')}`);
  return `ヒートマップ（列: ${s.cols.join('、')}）。${rows.join('。')}`;
}
export function heatmapTexts(s: HeatmapSpec): [string, number][] {
  const out: [string, number][] = [];
  for (const r of s.rows) out.push([r, 400], [r, 700]);
  for (const c of s.cols) out.push([c, 400], [c, 700]);
  if (s.corner) out.push([s.corner, 400], [s.corner, 700]);
  for (const row of s.values) for (const v of row) out.push([v === null ? '–' : cellText(v, s), 700], [v === null ? '–' : cellText(v, s), 400]);
  for (let i = 0; i < s.levels; i++) out.push([rangeText(i, s), 400]);
  out.push(['凡例', 400]);
  return out;
}

export function layoutHeatmap(s: HeatmapSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf);
  const rowW = Math.min(Math.max(...s.rows.map(r => c.tw(r, s.rowHeader)), s.corner ? c.tw(s.corner, true) / 2 : 0) + 20, g.w * 0.3);
  const plotL = g.x + rowW, cellW = (g.x + g.w - plotL) / s.cols.length;
  const lh = c.lineH();
  // a row label wider than its column (at most 30% of the figure) wraps, and the rows grow to hold it
  const rowLs = s.rows.map(r => c.wrap(r, rowW - 8, s.rowHeader));
  for (const [i, ls] of rowLs.entries()) for (const l of ls) if (c.tw(l, s.rowHeader) > rowW - 4) fail('heatmap', `the row label "${s.rows[i]}" is too long for its column ${Math.floor(rowW)}px wide (shorten it, or raise width)`);
  const rowNeed = Math.max(...rowLs.map(ls => ls.length)) * lh + 8;
  const cellH = s.cellH ?? Math.max(S + 16, 32, rowNeed);
  if (!(s.cellH === undefined || s.cellH >= Math.max(S + 8, rowNeed))) fail('heatmap', `cellH ${s.cellH} is too small for the ${S}px text of its rows (at least ${Math.max(S + 8, rowNeed)})`);
  const texts = s.values.map(r => r.map(v => v === null ? '–' : cellText(v, s)));
  const widest = Math.max(...texts.flat().map(t => c.tw(t, true)));
  if (widest > cellW - 8) fail('heatmap', `the numbers (up to ${Math.ceil(widest)}px) do not fit in cells ${Math.floor(cellW)}px wide (raise width, use fewer columns, or drop the unit)`);
  const heads = s.cols.map(t => c.wrap(t, cellW - 6, true));
  for (const [i, h] of heads.entries()) for (const l of h) if (c.tw(l, true) > cellW - 4) fail('heatmap', `the column label "${s.cols[i]}" is too long for cells ${Math.floor(cellW)}px wide (shorten it, or raise width)`);
  const headH = Math.max(...heads.map(h => h.length), s.corner ? c.wrap(s.corner, rowW - 12, true).length : 1) * lh + 10;
  const ops = shadeOps(s.levels);
  const bodyT = g.y + headH, gap = 2;
  // the legend: one swatch per shade with the range it stands for; it wraps to a second line when it is long
  const legend: {x: number; y: number; level: number; text: string}[] = [];
  let legendH = 0;
  if (s.scale) {
    const sw = 22, items = Array.from({length: s.levels}, (_, i) => ({level: i, text: rangeText(i, s)}));
    let lx = g.x + c.tw('凡例') + 14, ly = 0;
    for (const it of items) {
      const w = sw + 6 + c.tw(it.text) + 18;
      if (lx + w - 18 > g.x + g.w && lx > g.x + c.tw('凡例') + 14) { lx = g.x; ly += lh + 6; }
      legend.push({x: lx, y: ly, ...it}); lx += w;
    }
    legendH = ly + S + 14 + 8;
  }
  c.h = g.height ?? headH + s.rows.length * cellH + (s.scale ? legendH + 6 : 0) + 4;
  if (g.height !== undefined && g.height < headH + s.rows.length * cellH + legendH) fail('heatmap', `height ${g.height} is too small for ${s.rows.length} rows (need at least ${headH + s.rows.length * cellH + legendH})`);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  if (s.corner) c.lines(c.wrap(s.corner, rowW - 12, true), g.x + 4, g.y + headH - 8 - (c.wrap(s.corner, rowW - 12, true).length - 1) * lh, 'start', 'muted', {bold: true});
  heads.forEach((h, i) => c.lines(h, plotL + (i + 0.5) * cellW, g.y + headH - 8 - (h.length - 1) * lh, 'middle', 'text', {bold: true}));
  s.rows.forEach((r, i) => {
    const y = bodyT + i * cellH, cy = y + cellH / 2;
    c.lines(rowLs[i], g.x + 4, c.mid(cy) - (rowLs[i].length - 1) * lh / 2, 'start', 'text', {bold: s.rowHeader});
    s.values[i].forEach((v, j) => {
      const x = plotL + j * cellW, t = texts[i][j];
      if (v === null) {
        const host = c.rect(r1(x + gap / 2), r1(y + gap / 2), r1(cellW - gap), r1(cellH - gap), {fill: 'none', stroke: 'border', sw: 2, dash: '3,3', solid: `cell ${r} x ${s.cols[j]}`});
        c.text(t, x + cellW / 2, c.mid(cy), 'middle', 'muted', {host});
        return;
      }
      const op = ops[heatLevel(v, s)], ink = inkOnShade(op);
      const host = c.rect(r1(x + gap / 2), r1(y + gap / 2), r1(cellW - gap), r1(cellH - gap), {fill: 'accent', op, solid: `cell ${r} x ${s.cols[j]}`});
      c.text(t, x + cellW / 2, c.mid(cy), 'middle', ink, {bold: true, host, on: {fill: 'accent', op, ink}});
    });
  });
  if (s.rowHeader) c.line(r1(plotL - 2), r1(bodyT), r1(plotL - 2), r1(bodyT + s.rows.length * cellH), {stroke: 'border'});
  if (s.scale) {
    const top = bodyT + s.rows.length * cellH + 14;
    c.text('凡例', g.x, c.mid(top + 7), 'start', 'muted', {});
    for (const l of legend) {
      const y = top + l.y;
      c.rect(r1(l.x), r1(y), 22, 14, {fill: 'accent', op: ops[l.level], stroke: 'accent', sw: 2});
      c.text(l.text, l.x + 28, c.mid(y + 7), 'start', 'text');
    }
  }
  void Canvas;
  return c.done();
}
