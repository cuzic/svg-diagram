// catplot(): seaborn's categorical plots from the values themselves — boxplot, violinplot, stripplot, swarmplot, pointplot, barplot (with an error
// bar) — one figure, one or several layers (a box with its points laid over it), vertical or horizontal, with an optional `hue` (a second category
// drawn side by side within each group). The statistics (quartiles, a kernel density, a confidence interval, a beeswarm) are worked out here
// from the raw values (lib/stats.ts), deterministically: the same data draws the same figure.
import {Canvas, checkIds, checkText, fail, finiteNum, niceScale, numText, shadeOps} from './charts-base.ts';
import type {ChartGeom, ChartOpts, LaidOutChartPart} from './charts-base.ts';
import {boxStats, errorBar, kde, meanOf, swarmOffsets} from './stats.ts';
import type {BoxStats, ErrorKind} from './stats.ts';
import type {ColorKey} from './types/core.ts';

export type CatKind = 'box' | 'violin' | 'strip' | 'swarm' | 'point' | 'bar';
const KINDS: readonly CatKind[] = ['box', 'violin', 'strip', 'swarm', 'point', 'bar'];
/** The function that draws a single kind, for the messages. */
export const FN: Record<CatKind, string> = {box: 'boxplot', violin: 'violinplot', strip: 'stripplot', swarm: 'swarmplot', point: 'pointplot', bar: 'barplot'};
const NAME: Record<CatKind, string> = {box: '箱ひげ図', violin: 'バイオリンプロット', strip: 'ストリッププロット', swarm: 'スウォームプロット', point: 'ポイントプロット', bar: '棒グラフ（誤差つき）'};
/** A group of values: its own, or one list per hue (a second category). */
export interface CatGroup {label: string; values?: readonly number[]; hues?: readonly {name: string; values: readonly number[]}[]; id?: string}
export interface CatOpts extends ChartOpts {
  /** The layers, drawn in this order (default 'box'). `['violin', 'strip']` lays the points over the violins. */
  kind?: CatKind | readonly CatKind[];
  /** 'v': the groups along the bottom (default); 'h': down the left. */
  dir?: 'v' | 'h';
  /** The name of the value axis. */
  label?: string;
  unit?: string;
  /** The error bar of `point` and `bar`: the 95% confidence interval of the mean (default), ±1 standard deviation / standard error, the full range, or none. */
  error?: ErrorKind;
  /** Write each group's median / mean beside it (`bar` writes the mean by default). */
  values?: 'median' | 'mean' | 'none';
  /** Write `n = …` under each group's name. */
  counts?: boolean;
  /** `violin`: every violin as wide as the slot allows ('width'), or the areas comparable (default 'area': a spread-out group is wider and flatter). */
  scale?: 'area' | 'width';
}
interface Series {name: string; values: number[]; n: number; mean: number; box: BoxStats; err?: [number, number]}
export interface CatSpec {
  groups: {label: string; id?: string; series: (Series | undefined)[]}[];
  hues: string[]; kinds: CatKind[]; dir: 'v' | 'h'; label: string; unit: string; error: ErrorKind; values: 'median' | 'mean' | 'none'; counts: boolean; scale: 'area' | 'width';
}

const MAX_HUES = 4, MAX_GROUPS = 24;
export function resolveCat(who: string, data: readonly CatGroup[] | Readonly<Record<string, readonly number[]>>, opts: CatOpts, defaultKind: CatKind = 'box'): CatSpec {
  const list: CatGroup[] = Array.isArray(data) ? [...data] : Object.entries(data as Record<string, readonly number[]>).map(([label, values]) => ({label, values}));
  if (list.length === 0) fail(who, 'needs at least one group');
  if (list.length > MAX_GROUPS) fail(who, `${list.length} groups are too many for one figure (at most ${MAX_GROUPS})`);
  checkIds(who, list.map(g => g.id), opts.id);
  const kinds = (opts.kind === undefined ? [defaultKind] : Array.isArray(opts.kind) ? [...opts.kind] : [opts.kind]) as CatKind[];
  if (kinds.length === 0 || kinds.some(k => !KINDS.includes(k))) fail(who, `kind must be ${KINDS.join(' / ')} (or a list of them; got ${JSON.stringify(opts.kind)})`);
  if (new Set(kinds).size !== kinds.length) fail(who, 'each kind may appear once in kind');
  if (kinds.includes('strip') && kinds.includes('swarm')) fail(who, 'strip and swarm both place every point: use one of them');
  if (kinds.includes('bar') && kinds.includes('point')) fail(who, 'bar and point both show the mean: use one of them');
  const dir = opts.dir ?? 'v', error = opts.error ?? 'ci', values = opts.values ?? (kinds.includes('bar') ? 'mean' : 'none'), scale = opts.scale ?? 'area';
  if (dir !== 'v' && dir !== 'h') fail(who, `dir must be 'v' or 'h' (got ${String(opts.dir)})`);
  if (!['ci', 'sd', 'se', 'range', 'none'].includes(error)) fail(who, `error must be ci / sd / se / range / none (got ${String(opts.error)})`);
  if (!['median', 'mean', 'none'].includes(values)) fail(who, `values must be median / mean / none (got ${String(opts.values)})`);
  if (!['area', 'width'].includes(scale)) fail(who, `scale must be area or width (got ${String(opts.scale)})`);
  const hasHue = list.some(g => g.hues !== undefined);
  if (hasHue && list.some(g => g.hues === undefined)) fail(who, 'when one group has hues, every group needs them (give `hues` in each, not `values`)');
  if (list.some(g => g.hues !== undefined && g.values !== undefined)) fail(who, 'a group has either values or hues, not both');
  const hues = [...new Set(list.flatMap(g => (g.hues ?? []).map(h => checkText(who, 'a hue name', h.name))))];
  if (hues.length > MAX_HUES) fail(who, `at most ${MAX_HUES} hues (got ${hues.length}: ${hues.join(', ')})`);
  const series = (g: CatGroup, name: string, vs: readonly number[] | undefined): Series | undefined => {
    if (vs === undefined || vs.length === 0) return undefined;
    const what = `"${g.label}"${name ? ` / "${name}"` : ''}`;
    const v = vs.map((x, i) => finiteNum(who, `${what} value ${i + 1}`, x));
    if (kinds.includes('violin') && (v.length < 2 || Math.min(...v) === Math.max(...v))) fail(who, `${what}: a violin needs at least two different values (use box / strip for a group this small)`);
    return {name, values: v, n: v.length, mean: meanOf(v), box: boxStats(v), ...(kinds.some(k => k === 'point' || k === 'bar') ? (() => { const e = errorBar(v, error); return e ? {err: e} : {}; })() : {})};
  };
  const groups = list.map((g, i) => {
    const label = checkText(who, `group ${i + 1}'s label`, g.label);
    const s = hasHue ? hues.map(h => series(g, h, g.hues?.find(x => x.name === h)?.values)) : [series(g, '', g.values)];
    if (s.every(x => x === undefined)) fail(who, `"${label}" has no values`);
    return {label, ...(g.id === undefined ? {} : {id: g.id}), series: s};
  });
  return {groups, hues, kinds, dir, label: opts.label ?? '', unit: opts.unit ?? '', error, values, counts: !!opts.counts, scale};
}

/** `n = 16`, or `n = 16 / 15` when the group has a hue each. */
const countText = (g: CatSpec['groups'][number]): string => `n = ${g.series.flatMap(x => x ? [x.n] : []).join(' / ')}`;
const valueOf = (s: CatSpec, x: Series): number => s.values === 'mean' ? x.mean : x.box.median;
export function catAlt(s: CatSpec): string {
  const stat = (x: Series): string => s.kinds.includes('bar') || s.kinds.includes('point')
    ? `平均 ${numText(x.mean)}${s.unit}${x.err ? `（${s.error === 'ci' ? '95%信頼区間' : s.error === 'sd' ? '±標準偏差' : s.error === 'se' ? '±標準誤差' : '範囲'} ${numText(x.err[0])}〜${numText(x.err[1])}）` : ''}`
    : `中央値 ${numText(x.box.median)}${s.unit}（四分位 ${numText(x.box.q1)}〜${numText(x.box.q3)}）`;
  return `${s.kinds.map(k => NAME[k]).join('＋')}${s.label ? `（${s.label}）` : ''}: ${s.groups.map(g => g.series.flatMap(x => x ? [`${g.label}${x.name ? ` ${x.name}` : ''} n=${x.n} ${stat(x)}`] : []).join('、')).join('、')}`;
}
export function catTexts(s: CatSpec): [string, number][] {
  const out: [string, number][] = [];
  for (const g of s.groups) { out.push([g.label, 700]); if (s.counts) out.push([countText(g), 400]); }
  for (const h of s.hues) out.push([h, 400]);
  if (s.label) out.push([s.label, 700]);
  const all = s.groups.flatMap(g => g.series.flatMap(x => x ? [x.box.min, x.box.max, ...(x.err ?? [])] : []));
  for (const t of niceScale(Math.min(...all, ...(s.kinds.includes('bar') ? [0] : [])), Math.max(...all, ...(s.kinds.includes('bar') ? [0] : []))).ticks) out.push([numText(t), 400]);
  for (const g of s.groups) for (const x of g.series) if (x && s.values !== 'none') out.push([`${numText(valueOf(s, x))}${s.unit}`, 700]);
  return out;
}

export type Shape = 'disc' | 'diamond' | 'square' | 'triangle' | 'ring';
export const SHAPES: Shape[] = ['disc', 'diamond', 'square', 'triangle'];
const r1 = (v: number): number => Math.round(v * 10) / 10;
export function markerPath(shape: Shape, x: number, y: number, r: number): string {
  const [a, b, c, d] = [x - r, x + r, y - r, y + r].map(r1);
  switch (shape) {
    case 'diamond': return `M${r1(x)},${c} L${b},${r1(y)} L${r1(x)},${d} L${a},${r1(y)} Z`;
    case 'square': return `M${a},${c} H${b} V${d} H${a} Z`;
    case 'triangle': return `M${r1(x)},${c} L${b},${d} L${a},${d} Z`;
    default: return `M${a},${r1(y)} a${r},${r} 0 1,0 ${r1(2 * r)},0 a${r},${r} 0 1,0 ${r1(-2 * r)},0 Z`;
  }
}

export function layoutCat(s: CatSpec, g: ChartGeom): LaidOutChartPart {
  const who = s.kinds.length === 1 ? FN[s.kinds[0]] : 'catplot';
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf), lh = c.lineH(), v = s.dir === 'v', n = s.groups.length, H = Math.max(1, s.hues.length);
  const rectKind = s.kinds.some(k => k === 'box' || k === 'violin' || k === 'bar');
  const all = s.groups.flatMap(gr => gr.series.flatMap(x => x ? [x.box.min, x.box.max, ...(x.err ?? [])] : []));
  const sc = niceScale(Math.min(...all, ...(s.kinds.includes('bar') ? [0] : [])), Math.max(...all, ...(s.kinds.includes('bar') ? [0] : [])));
  const tick = (t: number) => numText(t);
  // the legend (one swatch per hue) and the value axis' name, above the plot
  const legend: {x: number; row: number; i: number}[] = [];
  let lx = g.x, row = 0;
  s.hues.forEach((h, i) => {
    const w = 14 + 6 + c.tw(h) + 22;
    if (lx + w - 22 > g.x + g.w && lx > g.x) { lx = g.x; row++; }
    legend.push({x: lx, row, i}); lx += w;
  });
  const legendH = s.hues.length ? (row + 1) * (S + 12) : 0;
  const nameH = v && s.label ? S + 10 : 0;
  const headH = legendH + nameH;
  // plot area and the category labels
  const tickW = Math.max(...sc.ticks.map(t => c.tw(tick(t))));
  const labelW = v ? 0 : Math.min(Math.max(...s.groups.map(gr => Math.max(c.tw(gr.label, true), s.counts ? c.tw(countText(gr)) : 0))) + 14, g.w * 0.3);
  const plotL = v ? g.x + tickW + 16 : g.x + labelW + 8, plotR = g.x + g.w - (v ? 8 : Math.ceil(c.tw(tick(sc.ticks[sc.ticks.length - 1])) / 2) + 6);
  if (plotR - plotL < 80) fail(who, 'the figure is too narrow for its labels (raise width, or shorten the group names)');
  const slotV = (plotR - plotL) / n;
  const wrapped = s.groups.map(gr => c.wrap(gr.label, v ? slotV - 8 : labelW - 14, true));
  const countLine = s.counts ? 1 : 0;
  const catH = v ? Math.max(...wrapped.map(l => l.length + countLine)) * lh + 14 : 0;
  const rowH = Math.max(H * (S + 8) + 12, 52);
  const axisH = v ? 0 : S + 14 + (s.label ? S + 10 : 0);
  c.h = g.height ?? (v ? 320 + headH + catH - 40 : headH + n * rowH + axisH + 12);
  const plotT = v ? g.y + headH + Math.ceil(S / 2) + 4 : g.y + headH + 6, plotB = v ? g.y + c.h - catH - 6 : g.y + c.h - axisH - 6;
  if ((v ? plotB - plotT : (plotB - plotT) / n) < (v ? 120 : 30)) fail(who, v ? 'the figure is too short; raise height' : `the figure is too short for ${n} groups; raise height`);
  const yOf = (u: number) => plotB - (u - sc.min) / (sc.max - sc.min) * (plotB - plotT), xOf = (u: number) => plotL + (u - sc.min) / (sc.max - sc.min) * (plotR - plotL);
  const px = (u: number) => v ? yOf(u) : xOf(u);
  const P = (k: number, u: number) => v ? {x: k, y: yOf(u)} : {x: xOf(u), y: k};
  const catA = v ? plotL : plotT, slot = ((v ? plotR - plotL : plotB - plotT)) / n;
  const gap = 4, bw = Math.min(s.kinds.every(k => k === 'point') ? 24 : v ? 64 : 40, (slot * 0.8 - (H - 1) * gap) / H); // a pointplot's groups sit close together
  if (bw < 8) fail(who, `the groups are too narrow (${Math.floor(bw)}px): raise width, use fewer groups / hues, or dir: 'h'`);
  const kc = (gi: number, hi: number) => catA + (gi + 0.5) * slot + (hi - (H - 1) / 2) * (bw + gap);
  const ops = shadeOps(H), fillOp = (hi: number, kind: CatKind) => H === 1 ? (kind === 'bar' ? 0.5 : 0.25) : ops[hi];
  const of = (gi: number) => s.groups[gi].id ?? `#${gi}`;
  const rectKU = (k0: number, k1: number, u0: number, u1: number, o: Parameters<Canvas['rect']>[4]) => {
    const a = P(k0, u0), b = P(k1, u1);
    return c.rect(r1(Math.min(a.x, b.x)), r1(Math.min(a.y, b.y)), r1(Math.abs(b.x - a.x)), r1(Math.abs(b.y - a.y)), o);
  };
  const lineKU = (k0: number, u0: number, k1: number, u1: number, o: Parameters<Canvas['line']>[4]) => { const a = P(k0, u0), b = P(k1, u1); c.line(a.x, a.y, b.x, b.y, o); };

  // legend, axis name
  const glyphs = !rectKind;
  legend.forEach(l => {
    const cy = g.y + l.row * (S + 12) + Math.max(9, Math.ceil(S * 0.64));
    if (glyphs) c.path(markerPath(SHAPES[l.i], l.x + 7, cy, 6), {fill: 'accent', op: 0.8});
    else c.rect(l.x, cy - 7, 14, 14, {fill: 'accent', op: fillOp(l.i, s.kinds[0]), stroke: 'accent', sw: 2});
    c.text(s.hues[l.i], l.x + 20, c.mid(cy), 'start', 'text');
  });
  const axisName = s.label;
  if (v && axisName) c.text(axisName, plotL - 4, g.y + legendH + S + 2, 'start', 'muted', {bold: true});
  // grid, ticks, baseline
  for (const t of sc.ticks) {
    if (v) { c.line(plotL - 6, yOf(t), plotR, yOf(t), {stroke: t === 0 && s.kinds.includes('bar') ? 'text' : 'border'}); c.text(tick(t), plotL - 10, c.mid(yOf(t)), 'end', 'muted'); }
    else { c.line(xOf(t), plotT, xOf(t), plotB + 6, {stroke: t === 0 && s.kinds.includes('bar') ? 'text' : 'border'}); c.text(tick(t), xOf(t), plotB + S + 10, 'middle', 'muted'); }
  }
  c.line(plotL, plotT, plotL, plotB, {stroke: 'border'});
  if (!v && axisName) c.text(axisName, (plotL + plotR) / 2, plotB + 2 * S + 22, 'middle', 'muted', {bold: true});

  // category labels
  s.groups.forEach((gr, gi) => {
    const cen = catA + (gi + 0.5) * slot, own = of(gi);
    const lines = [...wrapped[gi]];
    const total = lines.length + countLine, text = countText(gr);
    if (v) {
      c.lines(lines, cen, plotB + S + 11, 'middle', 'text', {bold: true, of: own});
      if (s.counts) c.text(text, cen, plotB + S + 11 + lines.length * lh, 'middle', 'muted', {of: own});
    } else {
      const top = cen - (total - 1) * lh / 2 + S * 0.36;
      c.lines(lines, plotL - 10, top, 'end', 'text', {bold: true, of: own});
      if (s.counts) c.text(text, plotL - 10, top + lines.length * lh, 'end', 'muted', {of: own});
    }
    c.anchors.push(v ? {id: gr.id ?? '', x: r1(catA + gi * slot), y: r1(plotT), w: r1(slot), h: r1(plotB - plotT)} : {id: gr.id ?? '', x: r1(plotL), y: r1(catA + gi * slot), w: r1(plotR - plotL), h: r1(slot)});
    if (!gr.id) c.anchors.pop();
  });

  // the layers, in the order given
  const draw = (fn: (x: Series, gi: number, hi: number, k: number) => void) => s.groups.forEach((gr, gi) => gr.series.forEach((x, hi) => { if (x) fn(x, gi, hi, kc(gi, hi)); }));
  const pts = s.kinds.includes('strip') || s.kinds.includes('swarm');
  const marks: {x: number; y: number}[] = [];
  const dot = (shape: Shape, p: {x: number; y: number}, r: number, o: {fill: ColorKey | 'none'; op?: number; stroke?: ColorKey; sw?: number; of: string}) => { c.path(markerPath(shape, p.x, p.y, r), o); marks.push(p); };
  const errBar = (x: Series, k: number, hi: number, own: string) => {
    if (!x.err) return;
    const cap = Math.min(bw / 4, 8);
    lineKU(k, x.err[0], k, x.err[1], {stroke: 'text', sw: 2, of: own});
    for (const u of x.err) lineKU(k - cap, u, k + cap, u, {stroke: 'text', sw: 2, of: own});
    void hi;
  };
  for (const kind of s.kinds) {
    if (kind === 'bar') draw((x, gi, hi, k) => {
      const own = of(gi);
      rectKU(k - bw / 2, k + bw / 2, 0, x.mean, {fill: 'accent', op: fillOp(hi, 'bar'), stroke: 'accent', sw: 2, solid: `the bar of "${s.groups[gi].label}"${x.name ? ` / "${x.name}"` : ''}`, of: own});
      errBar(x, k, hi, own);
    });
    if (kind === 'violin') {
      const dens = s.groups.map(gr => gr.series.map(x => { if (!x) return undefined; const grid = Array.from({length: 41}, (_q, i) => x.box.min + (x.box.max - x.box.min) * i / 40); return {grid, ...kde(x.values, grid)}; }));
      const top = Math.max(...dens.flatMap(r => r.map(d => d ? Math.max(...d.density) : 0)));
      draw((x, gi, hi, k) => {
        const d = dens[gi][hi]!, own = of(gi), norm = s.scale === 'area' ? top : Math.max(...d.density);
        const half = d.density.map(q => q / norm * bw / 2);
        const side = (sgn: number) => d.grid.map((u, i) => P(k + sgn * half[i], u));
        const left = side(-1), right = side(1).reverse(), pth = [...left, ...right].map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)},${r1(p.y)}`).join(' ') + ' Z';
        c.path(pth, {fill: 'accent', op: fillOp(hi, 'violin'), stroke: 'accent', sw: 2, of: own});
        const a = P(k - bw / 2, x.box.min), b = P(k + bw / 2, x.box.max);
        c.solids.push({x: r1(Math.min(a.x, b.x)), y: r1(Math.min(a.y, b.y)), w: r1(Math.abs(b.x - a.x)), h: r1(Math.abs(b.y - a.y)), label: `the violin of "${s.groups[gi].label}"${x.name ? ` / "${x.name}"` : ''}`});
        lineKU(k, x.box.q1, k, x.box.q3, {stroke: 'text', sw: 5, of: own});
        const m = P(k, x.box.median);
        c.path(markerPath('disc', m.x, m.y, 2.5), {fill: 'bg', of: own});
      });
    }
    if (kind === 'box') draw((x, gi, hi, k) => {
      const own = of(gi), b = x.box, cap = bw / 4;
      lineKU(k, b.lo, k, b.q1, {stroke: 'accent', sw: 2, of: own}); lineKU(k, b.q3, k, b.hi, {stroke: 'accent', sw: 2, of: own});
      for (const u of [b.lo, b.hi]) lineKU(k - cap, u, k + cap, u, {stroke: 'accent', sw: 2, of: own});
      rectKU(k - bw / 2, k + bw / 2, b.q1, b.q3, {fill: 'accent', op: fillOp(hi, 'box'), stroke: 'accent', sw: 2, solid: `the box of "${s.groups[gi].label}"${x.name ? ` / "${x.name}"` : ''}`, of: own});
      lineKU(k - bw / 2, b.median, k + bw / 2, b.median, {stroke: 'text', sw: 3, of: own});
      if (!pts) for (const u of b.fliers) dot('ring', P(k, u), 3, {fill: 'none', stroke: 'accent', sw: 2, of: own});
    });
    if (kind === 'point') {
      for (let hi = 0; hi < H; hi++) {
        const through = s.groups.flatMap((_gr, gi) => { const x = s.groups[gi].series[hi]; return x ? [P(kc(gi, hi), x.mean)] : []; });
        if (through.length > 1) c.path(through.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)},${r1(p.y)}`).join(' '), {fill: 'none', stroke: 'accent', sw: 2, dash: ['', '6,4', '2,4', '10,4,2,4'][hi] || undefined, of: s.groups.map((_g, gi) => of(gi))});
      }
      draw((x, gi, hi, k) => { const own = of(gi); errBar(x, k, hi, own); dot(SHAPES[hi], P(k, x.mean), 5.5, {fill: 'accent', stroke: 'bg', sw: 1.5, of: own}); });
    }
    if (kind === 'strip' || kind === 'swarm') draw((x, gi, hi, k) => {
      const own = of(gi), r = 3.5, free = bw / 2 - r;
      const offs = kind === 'swarm'
        ? swarmOffsets(x.values.map(px), 2 * r + 1, free)
        : x.values.map((_q, i) => ((i * 0.6180339887) % 1 - 0.5) * 2 * free);
      if (!offs) fail(who, `the points of "${s.groups[gi].label}"${x.name ? ` / "${x.name}"` : ''} do not fit side by side in ${Math.floor(bw)}px (raise width / height, use fewer groups, or stripplot)`);
      x.values.forEach((u, i) => dot(SHAPES[hi], P(k + (offs as number[])[i], u), r, {fill: 'accent', op: 0.8, stroke: 'bg', sw: 1, of: own}));
    });
  }
  for (const m of marks) c.marks.push({x: m.x - 4, y: m.y - 4, w: 8, h: 8});

  // each group's median / mean, written beside it
  if (s.values !== 'none') draw((x, gi, hi, k) => {
    const own = of(gi), u = valueOf(s, x), text = `${numText(u)}${s.unit}`, p = P(k, u), half = bw / 2 + 6, top = P(k, x.err ? Math.max(...x.err) : x.box.hi);
    const cands = v
      ? [{x: p.x + half, y: c.mid(p.y), anchor: 'start' as const}, {x: p.x - half, y: c.mid(p.y), anchor: 'end' as const}, {x: top.x, y: top.y - 8, anchor: 'middle' as const}]
      : [{x: top.x + 8, y: c.mid(top.y), anchor: 'start' as const}, {x: p.x, y: p.y - bw / 2 - 5, anchor: 'middle' as const}, {x: p.x, y: p.y + bw / 2 + S + 3, anchor: 'middle' as const}];
    const above = s.kinds.includes('bar') || s.kinds.includes('point');
    if (!c.place(text, above ? [cands[2], ...cands.slice(0, 2)] : cands, 'text', {bold: true, of: own})) c.omitted.push(`${s.groups[gi].label}${x.name ? ` ${x.name}` : ''} ${text}`);
  });
  return c.done();
}
