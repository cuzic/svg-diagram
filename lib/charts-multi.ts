// hist2d(), jointplot(), pairplot(): seaborn's multi-variable plots from columns of raw values. hist2d counts the points in a grid of round-sized
// cells; jointplot is a scatter with the two marginal histograms; pairplot is a matrix of scatters with a histogram of each variable on the
// diagonal. Groups (a label per row) are told apart by marker shape and outline style as well as colour. Nothing is random.
import {Canvas, checkIds, checkText, fail, finiteNum, inkOnShade, niceScale, numText} from './charts-base.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';
import {markerPath, SHAPES} from './charts-cat.ts';
import {histogramBins} from './qc.ts';
import {binCounts, binIndex, kde2d} from './stats.ts';

export type MultiMode = 'hist2d' | 'kde2d' | 'joint' | 'pair';
export interface MultiOpts extends ChartOpts {
  /** The axis names (hist2d / jointplot). */
  xLabel?: string;
  yLabel?: string;
  /** hist2d / jointplot: about this many classes along an axis (round class widths). */
  bins?: number;
  /** pairplot: only the lower triangle and the diagonal. */
  corner?: boolean;
  /** One label per row of the data: each label is a group (up to 4). */
  groups?: readonly string[];
}
export interface XY {x: readonly number[]; y: readonly number[]; group?: readonly string[]}
export interface MultiSpec {
  mode: MultiMode; xLabel: string; yLabel: string; bins?: number; corner: boolean; ids: string[];
  /** hist2d / joint */
  x: number[]; y: number[];
  /** pair */
  vars: {name: string; values: number[]}[];
  /** The group of every row (0 when there are none) and their names. */
  gi: number[]; names: string[];
}
const TONES: ChartTone[] = ['accent', 'danger', 'text', 'muted'], DASH = ['', '6,4', '2,4', '10,4,2,4'];
const col = (who: string, what: string, v: readonly number[] | undefined): number[] => {
  if (!Array.isArray(v) || v.length < 2) fail(who, `${what} needs at least two values`);
  return (v as number[]).map((q, i) => finiteNum(who, `${what} value ${i + 1}`, q));
};
function groupsOf(who: string, group: readonly string[] | undefined, n: number): {gi: number[]; names: string[]} {
  if (group === undefined) return {gi: new Array<number>(n).fill(0), names: []};
  if (group.length !== n) fail(who, `groups has ${group.length} labels for ${n} rows`);
  const names = [...new Set(group)];
  if (names.length > TONES.length) fail(who, `at most ${TONES.length} groups (got ${names.length}: ${names.join(', ')})`);
  names.forEach(g => checkText(who, 'a group label', g));
  return {gi: group.map(g => names.indexOf(g)), names};
}
export function resolveMulti(who: string, mode: MultiMode, data: XY | Readonly<Record<string, readonly number[]>>, opts: MultiOpts): MultiSpec {
  checkIds(who, [], opts.id);
  const base = {mode, xLabel: opts.xLabel ?? '', yLabel: opts.yLabel ?? '', corner: !!opts.corner, ids: [], x: [], y: [], vars: [] as MultiSpec['vars']};
  if (opts.bins !== undefined && !(Number.isInteger(opts.bins) && opts.bins >= 1)) fail(who, `bins must be a whole number >= 1 (got ${opts.bins})`);
  const bins = opts.bins === undefined ? {} : {bins: opts.bins};
  if (mode === 'pair') {
    const entries = Object.entries(data as Record<string, readonly number[]>);
    if (entries.length < 2 || entries.length > 6) fail(who, `needs 2 to 6 variables (got ${entries.length})`);
    const vars = entries.map(([name, v]) => ({name: checkText(who, 'a variable name', name), values: col(who, `"${name}"`, v)}));
    if (vars.some(v => v.values.length !== vars[0].values.length)) fail(who, 'every variable needs the same number of values');
    const {gi, names} = groupsOf(who, opts.groups, vars[0].values.length);
    return {...base, ...bins, vars, gi, names};
  }
  const d = data as XY;
  if (d === null || typeof d !== 'object' || !('x' in d) || !('y' in d)) fail(who, 'needs columns: {x: [..], y: [..]}');
  const x = col(who, 'x', d.x), y = col(who, 'y', d.y);
  if (x.length !== y.length) fail(who, `x has ${x.length} values and y has ${y.length}`);
  const {gi, names} = mode === 'hist2d' || mode === 'kde2d' ? {gi: new Array<number>(x.length).fill(0), names: []} : groupsOf(who, d.group ?? opts.groups, x.length);
  return {...base, ...bins, x, y, gi, names};
}

const ax = (v: readonly number[]) => niceScale(Math.min(...v), Math.max(...v));
const classes = (v: readonly number[], bins?: number) => histogramBins(v, {bins: bins ?? Math.max(5, Math.min(12, Math.ceil(Math.sqrt(v.length))))});
export function multiAlt(s: MultiSpec): string {
  const r = (v: readonly number[]) => `${numText(Math.min(...v))}〜${numText(Math.max(...v))}`;
  if (s.mode === 'pair') return `散布図行列（${s.vars.map(v => `${v.name} ${r(v.values)}`).join('、')}、n=${s.vars[0].values.length}）`;
  return `${s.mode === 'hist2d' ? '2次元ヒストグラム' : s.mode === 'kde2d' ? '2次元密度（KDE）' : 'ジョイントプロット'}（${s.xLabel || 'x'} ${r(s.x)}、${s.yLabel || 'y'} ${r(s.y)}、n=${s.x.length}）`;
}
/** The grid the 2-D density is worked out on: the data widened by 1.5 bandwidths each way, to round limits. */
function density2d(s: MultiSpec) {
  const probe = kde2d(s.x, s.y, [0], [0]), xs = niceScale(Math.min(...s.x) - 1.5 * probe.bwx, Math.max(...s.x) + 1.5 * probe.bwx), ys = niceScale(Math.min(...s.y) - 1.5 * probe.bwy, Math.max(...s.y) + 1.5 * probe.bwy);
  const gx = Array.from({length: 61}, (_q, i) => xs.min + (xs.max - xs.min) * i / 60), gy = Array.from({length: 61}, (_q, j) => ys.min + (ys.max - ys.min) * j / 60);
  const z = kde2d(s.x, s.y, gx, gy).z;
  return {xs, ys, gx, gy, z, max: Math.max(...z.flat())};
}
const LEVELS = [0.1, 0.3, 0.5, 0.7, 0.9];
function grid2d(s: MultiSpec) {
  const bx = classes(s.x, s.bins), by = classes(s.y, s.bins);
  const cells = by.edges.slice(0, -1).map(() => new Array<number>(bx.edges.length - 1).fill(0));
  s.x.forEach((v, i) => { cells[binIndex(s.y[i], by.edges)][binIndex(v, bx.edges)]++; });
  return {bx, by, cells};
}
export function multiTexts(s: MultiSpec): [string, number][] {
  const out: [string, number][] = [];
  for (const n of s.names) out.push([n, 400]);
  if (s.xLabel) out.push([s.xLabel, 700]);
  if (s.yLabel) out.push([s.yLabel, 700]);
  const ticks = (v: readonly number[]) => ax(v).ticks.forEach(t => out.push([numText(t), 400]));
  if (s.mode === 'kde2d') { const d = density2d(s); d.xs.ticks.forEach(t => out.push([numText(t), 400])); d.ys.ticks.forEach(t => out.push([numText(t), 400])); out.push(['密度', 700], ['低', 400], ['高', 400]); return out; }
  if (s.mode === 'pair') for (const v of s.vars) { out.push([v.name, 700]); ticks(v.values); }
  else { ticks(s.x); ticks(s.y); }
  if (s.mode === 'hist2d') {
    const {bx, by, cells} = grid2d(s);
    for (const t of [...bx.edges, ...by.edges]) out.push([numText(t), 400]);
    for (const r of cells) for (const q of r) if (q > 0) out.push([numText(q), 700]);
    out.push(['0', 400], [numText(Math.max(...cells.flat())), 400], ['件数', 700]);
  }
  return out;
}

export function layoutMulti(s: MultiSpec, g: ChartGeom): LaidOutChartPart {
  const who = s.mode === 'hist2d' ? 'hist2d' : s.mode === 'kde2d' ? 'kde2d' : s.mode === 'joint' ? 'jointplot' : 'pairplot';
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf), r1 = (v: number) => Math.round(v * 10) / 10;
  const many = s.names.length > 1, tone = (i: number) => TONES[i] as 'accent';
  // legend of the groups: marker shape + dash + the name
  const legend: {x: number; row: number; i: number}[] = [];
  let lx = g.x, row = 0;
  if (many) s.names.forEach((nm, i) => { const w = 20 + 6 + c.tw(nm) + 22; if (lx + w - 22 > g.x + g.w && lx > g.x) { lx = g.x; row++; } legend.push({x: lx, row, i}); lx += w; });
  const legendH = many ? (row + 1) * (S + 12) : 0;
  legend.forEach(l => {
    const cy = g.y + l.row * (S + 12) + Math.max(9, Math.ceil(S * 0.64));
    c.path(markerPath(SHAPES[l.i], l.x + 7, cy, 5.5), {fill: tone(l.i), op: 0.85});
    c.text(s.names[l.i], l.x + 20, c.mid(cy), 'start', 'text');
  });
  const marks: {x: number; y: number}[] = [];
  const dots = (sx: (v: number) => number, sy: (v: number) => number, xs: readonly number[], ys: readonly number[], r: number) => xs.forEach((v, i) => {
    const q = {x: sx(v), y: sy(ys[i])}, k = s.gi[i];
    c.path(markerPath(SHAPES[k], q.x, q.y, r), {fill: tone(k), op: 0.75, stroke: 'bg', sw: 1}); marks.push(q);
  });
  /** Bars (one group: filled; several: a step outline each) of a histogram along one axis, for a marginal or a diagonal. */
  const hist = (values: readonly number[], edges: readonly number[], at: (v: number, h: number) => string, hmax: number, k: number, top: (v: number) => string) => {
    const cnt = binCounts(values, edges);
    void top;
    cnt.forEach((q, i) => {
      if (q <= 0) return;
      const h = q / hmax;
      if (!many) c.path(at(edges[i], h) + ' ' + at(edges[i + 1], h).replace('M', 'L') + ' ' + at(edges[i + 1], 0).replace('M', 'L') + ' Z', {fill: 'accent', op: 0.3, stroke: 'accent', sw: 2});
    });
    if (many) {
      let d = '';
      cnt.forEach((q, i) => { const h = q / hmax; d += `${i ? 'L' : 'M'}${at(edges[i], i ? cnt[i - 1] / hmax : 0).slice(1)} L${at(edges[i], h).slice(1)} L${at(edges[i + 1], h).slice(1)} `; });
      d += `L${at(edges[edges.length - 1], 0).slice(1)}`;
      c.path(d, {fill: 'none', stroke: tone(k), sw: 2, dash: DASH[k] || undefined});
    }
  };
  const gridAndTicks = (rect: {l: number; r: number; t: number; b: number}, xs: ReturnType<typeof ax> | undefined, ys: ReturnType<typeof ax> | undefined, o: {xt: boolean; yt: boolean; yRight?: boolean}) => {
    const sx = (v: number) => rect.l + (v - xs!.min) / (xs!.max - xs!.min) * (rect.r - rect.l), sy = (v: number) => rect.b - (v - ys!.min) / (ys!.max - ys!.min) * (rect.b - rect.t);
    if (xs) for (const t of xs.ticks) { c.line(sx(t), rect.t, sx(t), rect.b, {stroke: 'border'}); if (o.xt) c.text(numText(t), sx(t), rect.b + S + 14, 'middle', 'muted'); }
    if (ys) for (const t of ys.ticks) { c.line(rect.l, sy(t), rect.r, sy(t), {stroke: 'border'}); if (o.yt) c.text(numText(t), o.yRight ? rect.r + 8 : rect.l - 8, c.mid(sy(t)), o.yRight ? 'start' : 'end', 'muted'); }
    return {sx, sy};
  };

  if (s.mode === 'kde2d') {
    const d = density2d(s), tickW = Math.max(...d.ys.ticks.map(t => c.tw(numText(t)))), headH = S + 10 + (s.yLabel ? S + 10 : 0);
    const plotL = g.x + tickW + 16, plotR = g.x + g.w - 110, axisH = S + 20 + (s.xLabel ? S + 10 : 0);
    c.h = g.height ?? 360 + headH;
    const plotT = g.y + headH + Math.ceil(S / 2), plotB = g.y + c.h - axisH - 6;
    if (plotR - plotL < 120 || plotB - plotT < 120) fail(who, 'the figure is too small (raise width / height)');
    const sx = (v: number) => plotL + (v - d.xs.min) / (d.xs.max - d.xs.min) * (plotR - plotL), sy = (v: number) => plotB - (v - d.ys.min) / (d.ys.max - d.ys.min) * (plotB - plotT);
    const lvl = (v: number) => LEVELS.filter(f => v >= f * d.max).length, opOf = (l: number) => r1(0.1 + 0.15 * l);
    // filled bands: each node is a cell, a run of equal level along a row is one rect
    const dx = (plotR - plotL) / 60, dy = (plotB - plotT) / 60;
    for (let j = 0; j <= 60; j++) {
      let i = 0;
      while (i <= 60) {
        const l = lvl(d.z[j][i]); let k = i;
        while (k + 1 <= 60 && lvl(d.z[j][k + 1]) === l) k++;
        if (l > 0) { const x0 = Math.max(plotL, sx(d.gx[i]) - dx / 2), x1 = Math.min(plotR, sx(d.gx[k]) + dx / 2), y0 = Math.max(plotT, sy(d.gy[j]) - dy / 2), y1 = Math.min(plotB, sy(d.gy[j]) + dy / 2); c.rect(r1(x0), r1(y0), r1(x1 - x0) + 0.4, r1(y1 - y0) + 1.2, {fill: 'accent', op: opOf(l)}); }
        i = k + 1;
      }
    }
    for (const t of d.xs.ticks) { c.line(sx(t), plotB, sx(t), plotB + 6, {stroke: 'border'}); c.text(numText(t), sx(t), plotB + S + 14, 'middle', 'muted'); }
    for (const t of d.ys.ticks) { c.line(plotL - 6, sy(t), plotL, sy(t), {stroke: 'border'}); c.text(numText(t), plotL - 10, c.mid(sy(t)), 'end', 'muted'); }
    // iso-lines (marching squares) over the fill
    for (const f of LEVELS) {
      const th = f * d.max, segs: string[] = [], P = (i: number, j: number) => ({x: sx(d.gx[i]), y: sy(d.gy[j]), v: d.z[j][i]});
      const lerp = (a: ReturnType<typeof P>, b: ReturnType<typeof P>) => { const t = (th - a.v) / (b.v - a.v); return `${r1(a.x + (b.x - a.x) * t)},${r1(a.y + (b.y - a.y) * t)}`; };
      for (let j = 0; j < 60; j++) for (let i = 0; i < 60; i++) {
        const v0 = P(i, j), v1 = P(i + 1, j), v2 = P(i + 1, j + 1), v3 = P(i, j + 1), code = (v0.v >= th ? 1 : 0) | (v1.v >= th ? 2 : 0) | (v2.v >= th ? 4 : 0) | (v3.v >= th ? 8 : 0);
        const e = [() => lerp(v0, v1), () => lerp(v1, v2), () => lerp(v3, v2), () => lerp(v0, v3)];
        const table: Record<number, number[][]> = {1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]]};
        for (const [a, b] of table[code] ?? []) segs.push(`M${e[a]()} L${e[b]()}`);
      }
      if (segs.length) c.path(segs.join(' '), {fill: 'none', stroke: 'accent', sw: 1.5});
    }
    c.line(plotL, plotB, plotR, plotB, {stroke: 'text'}); c.line(plotL, plotT, plotL, plotB, {stroke: 'text'});
    if (s.yLabel) c.text(s.yLabel, plotL - 4, g.y + S + 2, 'start', 'muted', {bold: true});
    if (s.xLabel) c.text(s.xLabel, (plotL + plotR) / 2, plotB + 2 * S + 26, 'middle', 'muted', {bold: true});
    const lgx = plotR + 24;
    c.text('密度', lgx, plotT + S, 'start', 'muted', {bold: true});
    for (let k = 0; k < 6; k++) c.rect(lgx, plotT + S + 10 + k * 22, 22, 18, {fill: 'accent', op: opOf(5 - k), stroke: 'border', sw: 1});
    c.text('高', lgx + 30, c.mid(plotT + S + 19), 'start', 'text');
    c.text('低', lgx + 30, c.mid(plotT + S + 10 + 5 * 22 + 9), 'start', 'text');
    if (s.x.length <= 400) for (let i = 0; i < s.x.length; i++) { c.path(markerPath('disc', sx(s.x[i]), sy(s.y[i]), 2), {fill: 'text', op: 0.5}); }
  } else if (s.mode === 'hist2d') {
    const {bx, by, cells} = grid2d(s), xs = {min: bx.edges[0], max: bx.edges[bx.edges.length - 1], ticks: bx.edges}, ys = {min: by.edges[0], max: by.edges[by.edges.length - 1], ticks: by.edges};
    const max = Math.max(...cells.flat());
    const tickW = Math.max(...by.edges.map(t => c.tw(numText(t)))), headH = S + 10 + (s.yLabel ? S + 10 : 0);
    const plotL = g.x + tickW + 16, plotR = g.x + g.w - 150;
    const axisH = S + 20 + (s.xLabel ? S + 10 : 0);
    c.h = g.height ?? 360 + headH;
    const plotT = g.y + headH + Math.ceil(S / 2), plotB = g.y + c.h - axisH - 6;
    if (plotR - plotL < 120 || plotB - plotT < 120) fail(who, 'the figure is too small (raise width / height)');
    const sx = (v: number) => plotL + (v - xs.min) / (xs.max - xs.min) * (plotR - plotL), sy = (v: number) => plotB - (v - ys.min) / (ys.max - ys.min) * (plotB - plotT);
    // tick labels: the class boundaries, thinned so that neighbours do not touch
    const thin = (ticks: number[], px: (v: number) => number, size: (t: number) => number) => { const w = Math.max(...ticks.map(size)) + 10, pitch = Math.abs(px(ticks[1]) - px(ticks[0])), k = Math.max(1, Math.ceil(w / pitch)); return new Set(ticks.filter((_t, i) => i % k === 0)); };
    const showX = thin(xs.ticks, sx, t => c.tw(numText(t))), showY = thin(ys.ticks, sy, () => S + 2);
    for (const t of xs.ticks) if (showX.has(t)) c.text(numText(t), sx(t), plotB + S + 14, 'middle', 'muted');
    for (const t of ys.ticks) if (showY.has(t)) c.text(numText(t), plotL - 8, c.mid(sy(t)), 'end', 'muted');
    if (s.yLabel) c.text(s.yLabel, plotL - 4, g.y + S + 2, 'start', 'muted', {bold: true});
    if (s.xLabel) c.text(s.xLabel, (plotL + plotR) / 2, plotB + 2 * S + 26, 'middle', 'muted', {bold: true});
    cells.forEach((rw, j) => rw.forEach((q, i) => {
      if (q <= 0) return;
      const x0 = sx(bx.edges[i]), x1 = sx(bx.edges[i + 1]), y1 = sy(by.edges[j]), y0 = sy(by.edges[j + 1]), op = r1(0.12 + 0.78 * q / max), ink = inkOnShade(op);
      const host = c.rect(r1(x0), r1(y0), r1(x1 - x0), r1(y1 - y0), {fill: 'accent', op, stroke: 'bg', sw: 1, solid: `the cell ${i + 1},${j + 1}`});
      const t = numText(q);
      if (c.tw(t, true) + 6 <= x1 - x0 && S + 4 <= y1 - y0) c.text(t, (x0 + x1) / 2, c.mid((y0 + y1) / 2), 'middle', ink, {bold: true, host, on: {fill: 'accent', op, ink}});
    }));
    c.line(plotL, plotB, plotR, plotB, {stroke: 'text'}); c.line(plotL, plotT, plotL, plotB, {stroke: 'text'});
    // the colour scale: five shades from 0 to the largest count
    const lgx = plotR + 24, sw = 22;
    c.text('件数', lgx, plotT + S, 'start', 'muted', {bold: true});
    for (let k = 0; k < 5; k++) c.rect(lgx, plotT + S + 10 + k * 26, sw, 22, {fill: 'accent', op: r1(0.12 + 0.78 * (4 - k) / 4), stroke: 'border', sw: 1});
    c.text(numText(max), lgx + sw + 8, c.mid(plotT + S + 21), 'start', 'text');
    c.text('0', lgx + sw + 8, c.mid(plotT + S + 10 + 4 * 26 + 11), 'start', 'text');
  } else if (s.mode === 'joint') {
    const xs = ax(s.x), ys = ax(s.y), bx = classes(s.x, s.bins), by = classes(s.y, s.bins);
    const tickW = Math.max(...ys.ticks.map(t => c.tw(numText(t)))), headH = legendH + (s.yLabel ? S + 10 : 0), mh = 70;
    const mainL = g.x + tickW + 16, mainR = g.x + g.w - mh - 18, axisH = S + 14 + (s.xLabel ? S + 10 : 0);
    c.h = g.height ?? 400 + headH;
    const mainT = g.y + headH + mh + 8, mainB = g.y + c.h - axisH - 6;
    if (mainR - mainL < 120 || mainB - mainT < 120) fail(who, 'the figure is too small (raise width / height)');
    if (s.yLabel) c.text(s.yLabel, g.x, g.y + legendH + S + 2, 'start', 'muted', {bold: true});
    const {sx, sy} = gridAndTicks({l: mainL, r: mainR, t: mainT, b: mainB}, xs, ys, {xt: true, yt: true});
    c.line(mainL, mainB, mainR, mainB, {stroke: 'text'}); c.line(mainL, mainT, mainL, mainB, {stroke: 'text'});
    if (s.xLabel) c.text(s.xLabel, (mainL + mainR) / 2, mainB + 2 * S + 26, 'middle', 'muted', {bold: true});
    dots(sx, sy, s.x, s.y, 3.5);
    // marginals: the highest class of any group is the full height
    const top = g.y + headH, topB = mainT - 8, right = mainR + 8;
    const pergroup = (v: number[], edges: number[], k: number) => binCounts(v.filter((_q, i) => s.gi[i] === k), edges);
    const kk = Math.max(1, s.names.length);
    for (const [vals, edges, horizontal] of [[s.x, bx.edges, false], [s.y, by.edges, true]] as const) {
      const hmax = Math.max(...Array.from({length: kk}, (_q, k) => Math.max(...pergroup(vals as number[], edges as number[], k))));
      for (let k = 0; k < kk; k++) {
        const v = (vals as number[]).filter((_q, i) => s.gi[i] === k);
        if (!horizontal) hist(v, edges as number[], (e, h) => `M${r1(sx(e))},${r1(topB - h * (topB - top))}`, hmax, k, () => '');
        else hist(v, edges as number[], (e, h) => `M${r1(right + h * mh)},${r1(sy(e))}`, hmax, k, () => '');
      }
    }
    for (const m of marks) c.marks.push({x: m.x - 4, y: m.y - 4, w: 8, h: 8});
    void top;
  } else {
    const k = s.vars.length, scales = s.vars.map(v => ax(v.values)), bins = s.vars.map(v => classes(v.values, s.bins));
    const nameW = Math.min(Math.max(...s.vars.map(v => c.tw(v.name, true))) + 14, g.w * 0.22), tickW = Math.max(...scales.flatMap(q => q.ticks.map(t => c.tw(numText(t)))));
    const left = g.x + nameW + tickW + 14, cell = Math.floor((g.x + g.w - left - tickW - 14) / k);
    if (cell < 70) fail(who, 'the panels are too small (raise width, or use fewer variables)');
    const top = g.y + legendH + Math.ceil(S / 2) + 6, padX = Math.ceil(tickW) + 6, padY = S + 8, axisH = S + 14;
    c.h = g.height ?? top - g.y + k * cell + axisH + 10;
    if (g.height !== undefined && g.height < top - g.y + k * (70) + axisH) fail(who, 'the figure is too short; raise height');
    const side = Math.min(cell, Math.floor((c.h - (top - g.y) - axisH - 10) / k));
    for (let i = 0; i < k; i++) {
      const t = top + i * side, b = t + side - padY, wrap = c.wrap(s.vars[i].name, nameW - 14, true);
      c.lines(wrap, left - tickW - 12, c.mid(t + (b - t) / 2) - (wrap.length - 1) * c.lineH() / 2, 'end', 'text', {bold: true});
      for (let j = 0; j < k; j++) {
        if (s.corner && j > i) continue;
        const l = left + j * cell, r = l + cell - padX;
        if (i === j) {
          // the diagonal: a histogram of the variable
          const edges = bins[i].edges, kk = Math.max(1, s.names.length);
          const per = Array.from({length: kk}, (_q, q) => binCounts(s.vars[i].values.filter((_v, n) => s.gi[n] === q), edges)), hmax = Math.max(...per.flat());
          const sx = (v: number) => l + (v - scales[i].min) / (scales[i].max - scales[i].min) * (r - l);
          for (const tk of scales[i].ticks) c.line(sx(tk), t, sx(tk), b, {stroke: 'border'});
          for (let q = 0; q < kk; q++) hist(s.vars[i].values.filter((_v, n) => s.gi[n] === q), edges, (e, h) => `M${r1(sx(e))},${r1(b - h * (b - t) * 0.92)}`, hmax, q, () => '');
          c.line(l, b, r, b, {stroke: 'text'});
        } else {
          const {sx, sy} = gridAndTicks({l, r, t, b}, scales[j], scales[i], {xt: false, yt: false});
          c.line(l, b, r, b, {stroke: 'border'}); c.line(l, t, l, b, {stroke: 'border'});
          dots(sx, sy, s.vars[j].values, s.vars[i].values, 2.5);
        }
      }
    }
    // tick labels once per variable: under the last row, and beside the first column (the first row's on the right, where the diagonal has no scale)
    for (let j = 0; j < k; j++) {
      const l = left + j * cell, r = l + cell - padX, last = top + (k - 1) * side + side - padY;
      for (const tk of scales[j].ticks) c.text(numText(tk), l + (tk - scales[j].min) / (scales[j].max - scales[j].min) * (r - l), last + S + 14, 'middle', 'muted');
      c.text(s.vars[j].name, (l + r) / 2, last + 2 * S + 20, 'middle', 'text', {bold: true});
    }
    c.h = Math.max(c.h, top - g.y + k * side + 2 * S + 32);
    for (let i = 0; i < k; i++) {
      const t = top + i * side, b = t + side - padY, sy = (v: number) => b - (v - scales[i].min) / (scales[i].max - scales[i].min) * (b - t);
      if (i === 0 && k > 1 && !s.corner) { const r = left + (k - 1) * cell + cell - padX; for (const tk of scales[0].ticks) c.text(numText(tk), r + 8, c.mid(sy(tk)), 'start', 'muted'); }
      else if (i > 0) for (const tk of scales[i].ticks) c.text(numText(tk), left - 8, c.mid(sy(tk)), 'end', 'muted');
    }
    for (const m of marks) c.marks.push({x: m.x - 3, y: m.y - 3, w: 6, h: 6});
  }
  void Canvas;
  return c.done();
}
