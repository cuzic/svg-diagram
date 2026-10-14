// stackedBars() and mekko(): columns cut into segments. stackedBars() draws each column at one width, as absolute values or (percent: true)
// as 100% columns; mekko() (マリメッコ) makes the width of a column proportional to its total and the height of a segment its share of
// the column, so the area of a segment is its share of the whole. Every segment prints its number; one too small for it is left out of
// the drawing and stays in the description.
import {Canvas, checkIds, checkText, fail, finiteNum, inkOnShade, niceScale, numText, shadeOps} from './charts-base.ts';
import type {ChartGeom, ChartOpts, LaidOutChartPart} from './charts-base.ts';

import {must} from './must.ts';
export interface StackPart {label: string; value: number}
export interface StackColumn {label: string; parts: StackPart[]; id?: string}
export interface StackedOpts extends ChartOpts {
  unit?: string;
  /** 100% columns (each column's parts as shares of its total). */
  percent?: boolean;
}
export type StackMode = 'stacked' | 'percent' | 'mekko';
export interface StackedSpec {mode: StackMode; series: string[]; columns: {label: string; values: number[]; total: number; id?: string}[]; unit: string}

export function resolveStacked(who: string, columns: readonly StackColumn[], mode: StackMode, opts: StackedOpts): StackedSpec {
  if (!Array.isArray(columns) || columns.length === 0) fail(who, 'needs at least one column');
  if (columns.length > (mode === 'mekko' ? 12 : 20)) fail(who, `${columns.length} columns are too many for one figure (at most ${mode === 'mekko' ? 12 : 20})`);
  checkIds(who, columns.map(c => c.id), opts.id);
  const series: string[] = [];
  for (const [k, col] of columns.entries()) {
    checkText(who, `column ${k + 1}'s label`, col.label);
    if (!Array.isArray(col.parts) || col.parts.length === 0) fail(who, `column "${col.label}" needs parts: [{label, value}, ...]`);
    const seen = new Set<string>();
    for (const p of col.parts) {
      checkText(who, `a part of "${col.label}": label`, p.label);
      finiteNum(who, `"${p.label}" of "${col.label}"`, p.value, {min: 0});
      if (seen.has(p.label)) fail(who, `column "${col.label}" has "${p.label}" twice`);
      seen.add(p.label);
      if (!series.includes(p.label)) series.push(p.label);
    }
  }
  if (series.length > 6) fail(who, `${series.length} different parts are too many to tell apart (at most 6: fold the small ones into "その他")`);
  const cols = columns.map(c => {
    const values = series.map(s => c.parts.find(p => p.label === s)?.value ?? 0);
    const total = parseFloat(values.reduce((a, b) => a + b, 0).toPrecision(12));
    if (mode !== 'stacked' && !(total > 0)) fail(who, `column "${c.label}" adds up to 0, so it has no shares`);
    return {label: c.label, values, total, ...(c.id === undefined ? {} : {id: c.id})};
  });
  if (mode === 'stacked' && cols.every(c => c.total === 0)) fail(who, 'every column is 0');
  return {mode, series, columns: cols, unit: opts.unit ?? ''};
}
const pct = (v: number, total: number): string => `${numText(Math.round(v / total * 1000) / 10)}%`;
const segText = (s: StackedSpec, v: number, total: number): string => s.mode === 'stacked' ? `${numText(v)}${s.unit}` : pct(v, total);
export function stackedAlt(s: StackedSpec): string {
  const name = s.mode === 'mekko' ? 'マリメッコ図' : s.mode === 'percent' ? '100%積み上げ棒グラフ' : '積み上げ棒グラフ';
  const body = s.columns.map(c => `${c.label}（計 ${numText(c.total)}${s.unit}）: ${s.series.flatMap((n, i) => must(c.values[i]) > 0 || s.mode === 'stacked' ? [`${n} ${numText(must(c.values[i]))}${s.unit}${s.mode === 'stacked' ? '' : `（${pct(must(c.values[i]), c.total)}）`}`] : []).join('、')}`);
  return `${name}: ${body.join('。')}`;
}
export function stackedTexts(s: StackedSpec): [string, number][] {
  const out: [string, number][] = [];
  for (const n of s.series) out.push([n, 400], [n, 700]);
  for (const c of s.columns) {
    out.push([c.label, 400], [c.label, 700], [`計 ${numText(c.total)}${s.unit}`, 400], [`${numText(c.total)}${s.unit}`, 700]);
    if (s.mode === 'mekko') out.push([`（${pct(c.total, s.columns.reduce((a, b) => a + b.total, 0))}）`, 400]);
    s.series.forEach((n, i) => { if (must(c.values[i]) > 0) out.push([segText(s, must(c.values[i]), c.total), 700], [`${n} ${segText(s, must(c.values[i]), c.total)}`, 700]); });
  }
  const top = s.mode === 'stacked' ? niceScale(0, Math.max(...s.columns.map(c => c.total))) : undefined;
  if (top) for (const t of top.ticks) out.push([numText(t), 400]);
  else for (const t of [0, 20, 40, 60, 80, 100]) out.push([`${t}%`, 400]);
  return out.flatMap(([t, _w]) => [[t, 400], [t, 700]] as [string, number][]);
}

export function layoutStacked(s: StackedSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf), lh = c.lineH(), n = s.columns.length;
  const scale = s.mode === 'stacked' ? niceScale(0, Math.max(...s.columns.map(k => k.total))) : undefined;
  const ticks = scale ? scale.ticks.map(t => ({v: t, f: t / scale.max, s: numText(t)})) : [0, 20, 40, 60, 80, 100].map(t => ({v: t, f: t / 100, s: `${t}%`}));
  const tickW = Math.max(...ticks.map(t => c.tw(t.s)));
  const plotL = g.x + tickW + 16, plotR = g.x + g.w - 8, gap = s.mode === 'mekko' ? 3 : 14;
  // legend: the parts in the order they stack (the first at the bottom), a swatch with each
  const ops = shadeOps(s.series.length), opOf = (i: number) => must(ops[s.series.length - 1 - i]);
  const legend: {x: number; y: number; i: number}[] = [];
  let lx = plotL, ly = 0;
  s.series.forEach((nm, i) => {
    const w = 14 + 6 + c.tw(nm) + 22;
    if (lx + w - 22 > plotR && lx > plotL) { lx = plotL; ly += lh + 4; }
    legend.push({x: lx, y: ly, i}); lx += w;
  });
  const legendH = ly + S + 12;
  // column widths and labels
  const total = s.columns.reduce((a, b) => a + b.total, 0), avail = plotR - plotL - gap * (n - 1) - (s.mode === 'mekko' ? 0 : gap);
  // a column of stackedBars is 60% of its slot (at most 96px), and wider when its numbers need it (up to the slot less a gap): a number
  // that would fit in a wider column is not left out of the drawing for want of a few pixels
  const slotW0 = (plotR - plotL) / n;
  const numW = Math.max(0, ...s.columns.flatMap(k => k.values.flatMap(v => v > 0 ? [c.tw(segText(s, v, k.total), true) + 8] : [])));
  if (s.mode === 'stacked') { const totW = Math.max(...s.columns.map(k => c.tw(`${numText(k.total)}${s.unit}`, true))); if (totW + 6 > slotW0) fail('stackedBars', `the column totals (up to ${Math.ceil(totW)}px) do not fit side by side in columns ${Math.floor(slotW0)}px apart (raise width, use fewer columns, or a larger unit)`); }
  const barW = Math.min(Math.max(Math.min(96, slotW0 * 0.6), numW), slotW0 - 12);
  const widths = s.columns.map(k => s.mode === 'mekko' ? avail * k.total / total : Math.max(barW, Math.min(96, slotW0 * 0.6)));
  if (widths.some(w => w < 1)) fail(s.mode === 'mekko' ? 'mekko' : 'stackedBars', `a column is less than 1px wide (raise width, drop the smallest columns, or fold them together)`);
  const xs: number[] = [];
  if (s.mode === 'mekko') { let x = plotL; for (const w of widths) { xs.push(x); x += w + gap; } }
  else { const slot = (plotR - plotL) / n; widths.forEach((w, i) => xs.push(plotL + (i + 0.5) * slot - w / 2)); }
  // column labels, left to right: a mekko label may be wider than its narrow column (it is centred on it); one that would touch the label before
  // it is wrapped narrower, and failing that goes on a row below
  const catLines: {main: string[]; second: string[]; cx: number; row: number}[] = [];
  const prevRight: number[] = [-Infinity, -Infinity, -Infinity];
  s.columns.forEach((k, i) => {
    const second = s.mode === 'stacked' ? [] : s.mode === 'mekko' ? [`計 ${numText(k.total)}${s.unit}`, `（${pct(k.total, total)}）`] : [`計 ${numText(k.total)}${s.unit}`];
    const natural = Math.max(c.tw(k.label, true), ...second.map(t => c.tw(t)));
    const slotW = (plotR - plotL) / n - 8;
    const tries = s.mode === 'mekko' ? [Math.max(must(widths[i]), Math.min(natural, 128)), Math.max(must(widths[i]) + 24, 60), Math.max(must(widths[i]), 40), 72] : [slotW];
    let best: (typeof catLines)[number] | undefined;
    for (let row = 0; row < 3 && !best; row++) for (const maxW of tries) {
      const main = c.wrap(k.label, maxW, true), sec = second.flatMap(t => c.wrap(t, maxW));
      const half = Math.max(...main.map(l => c.tw(l, true)), ...sec.map(l => c.tw(l))) / 2;
      const cx = Math.min(Math.max(must(xs[i]) + must(widths[i]) / 2, g.x + half + 1), g.x + g.w - half - 1); // inside the figure
      if (cx - half >= must(prevRight[row]) + 6) { best = {main, second: sec, cx, row}; prevRight[row] = cx + half; break; }
    }
    if (!best) fail(s.mode === 'mekko' ? 'mekko' : 'stackedBars', `the label of "${k.label}" has no room under its column (shorten the labels, or raise width)`);
    catLines.push(must(best));
  });
  const blockH = Math.max(...catLines.map(k => k.main.length + k.second.length)) * lh + 4;
  const catH = (Math.max(...catLines.map(k => k.row)) + 1) * blockH + 13;
  c.h = g.height ?? 340 + Math.max(0, legendH - 22) + catH - 30;
  const plotT = g.y + legendH + 8 + (s.mode === 'stacked' ? S + 8 : 4), plotB = g.y + c.h - catH - 6;
  if (plotB - plotT < 120) fail(s.mode === 'mekko' ? 'mekko' : 'stackedBars', 'the figure is too short; raise height');
  const yOf = (f: number) => plotB - f * (plotB - plotT), r1 = (v: number) => Math.round(v * 10) / 10;
  legend.forEach(l => {
    // the row's centre low enough for the text's top to stay in the figure at a large label size (a canvas)
    const cy = g.y + l.y + Math.max(9, Math.ceil(S * 0.64));
    c.rect(l.x, cy - 7, 14, 14, {fill: 'accent', op: opOf(l.i), stroke: 'accent', sw: 2});
    c.text(must(s.series[l.i]), l.x + 20, c.mid(cy), 'start', 'text');
  });
  for (const t of ticks) { c.line(plotL - 6, yOf(t.f), plotR, yOf(t.f), {stroke: t.v === 0 ? 'text' : 'border'}); c.text(t.s, plotL - 10, c.mid(yOf(t.f)), 'end', 'muted'); }
  c.line(plotL, r1(yOf(1)), plotL, r1(yOf(0)), {stroke: 'border'});
  const omitted = c.omitted, beside: {text: string; x: number; y: number; key: string; left: string}[] = [];
  s.columns.forEach((k, ci) => {
    let acc = 0;
    const top = k.total;
    s.series.forEach((nm, si) => {
      const v = k.values[si] ?? 0;
      if (!(v > 0)) return;
      const f0 = (s.mode === 'stacked' ? acc / must(scale).max : acc / top), f1 = (s.mode === 'stacked' ? (acc + v) / must(scale).max : (acc + v) / top);
      acc += v;
      const y1 = yOf(f1), y0 = yOf(f0), full = y0 - y1, gp = Math.min(2, full * 0.3), h = full - gp, op = opOf(si), ink = inkOnShade(op);
      if (h < 0.5) { omitted.push(`${nm} ${segText(s, v, k.total)}（${k.label}）`); return; } // thinner than half a pixel: nothing to draw
      const host = c.rect(r1(must(xs[ci])), r1(y1 + gp), r1(must(widths[ci])), r1(h), {fill: 'accent', op, solid: `"${nm}" in "${k.label}"`, of: k.id ?? `#${ci}`});
      const whole = `${nm} ${segText(s, v, k.total)}`, short = segText(s, v, k.total);
      const room = h >= S + 6, cx = must(xs[ci]) + must(widths[ci]) / 2, cy = y1 + gp + h / 2;
      const pick = room && c.tw(whole, true) <= must(widths[ci]) - 8 ? whole : room && c.tw(short, true) <= must(widths[ci]) - 6 ? short : undefined;
      if (pick) c.text(pick, cx, c.mid(cy), 'middle', ink, {bold: true, host, on: {fill: 'accent', op, ink}, of: k.id ?? `#${ci}`});
      // a part with no room inside a column that has air beside it is written beside the column (after every column is drawn, so the label sees them all); a mekko's columns touch, so it is left out
      else if (s.mode === 'mekko') omitted.push(`${nm} ${short}（${k.label}）`);
      else beside.push({text: whole, x: must(xs[ci]) + must(widths[ci]) + 8, y: c.mid(cy), key: k.id ?? `#${ci}`, left: `${nm} ${short}（${k.label}）`});
    });
    if (k.id) c.anchors.push({id: k.id, x: must(xs[ci]), y: yOf(s.mode === 'stacked' ? k.total / must(scale).max : 1), w: must(widths[ci]), h: yOf(0) - yOf(s.mode === 'stacked' ? k.total / must(scale).max : 1)});
    if (s.mode === 'stacked') c.text(`${numText(k.total)}${s.unit}`, must(xs[ci]) + must(widths[ci]) / 2, yOf(k.total / must(scale).max) - 7, 'middle', 'text', {bold: true, of: k.id ?? `#${ci}`});
  });
  for (const b of beside) if (!c.place(b.text, [{x: b.x, y: b.y, anchor: 'start'}], 'text', {bold: true, of: b.key})) omitted.push(b.left);
  // column labels, the second line (the total) lighter
  s.columns.forEach((k, ci) => {
    const m = must(catLines[ci]), cx = m.cx;
    const top = plotB + S + 11 + m.row * blockH;
    c.lines(m.main, cx, top, 'middle', 'text', {bold: true, of: k.id ?? `#${ci}`});
    c.lines(m.second, cx, top + m.main.length * lh, 'middle', 'muted', {of: k.id ?? `#${ci}`});
  });
  void Canvas;
  return c.done();
}
