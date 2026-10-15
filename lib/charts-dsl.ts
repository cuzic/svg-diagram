// The band constructors behind waterfall(), radar(), heatmap(), ...: validate the data, work out the description, build the band.
// dsl.ts wraps each in a typed function that adds the handle (`.right`, `.at()`) and the typed anchor ids.
import {assertScope} from './scope-name.ts';
import {resolveWaterfall, waterfallAlt} from './charts-waterfall.ts';
import type {WaterfallOpts, WaterfallStep} from './charts-waterfall.ts';
import {resolveTornado, tornadoAlt} from './charts-tornado.ts';
import type {TornadoItem, TornadoOpts} from './charts-tornado.ts';
import {heatmapAlt, resolveHeatmap} from './charts-heatmap.ts';
import type {HeatmapOpts} from './charts-heatmap.ts';
import {resolveStacked, stackedAlt} from './charts-stacked.ts';
import type {StackColumn, StackedOpts, StackMode} from './charts-stacked.ts';
import {radarAlt, resolveRadar} from './charts-radar.ts';
import type {RadarOpts, RadarSeries} from './charts-radar.ts';
import {resolveTreemap, treemapAlt} from './charts-treemap.ts';
import type {TreemapNode, TreemapOpts} from './charts-treemap.ts';
import {resolveSankey, sankeyAlt} from './charts-sankey.ts';
import type {SankeyLink, SankeyNode, SankeyOpts} from './charts-sankey.ts';
import {catAlt, resolveCat} from './charts-cat.ts';
import type {CatGroup, CatKind, CatOpts} from './charts-cat.ts';
import {distAlt, resolveDist} from './charts-dist.ts';
import type {DistGroup, DistKind, DistOpts} from './charts-dist.ts';
import {multiAlt, resolveMulti} from './charts-multi.ts';
import type {MultiMode, MultiOpts, XY} from './charts-multi.ts';
import {regAlt, resolveReg} from './charts-reg.ts';
import type {RegData, RegOpts} from './charts-reg.ts';
import {clusterAlt, resolveCluster} from './charts-cluster.ts';
import type {ClusterOpts} from './charts-cluster.ts';
import {bubbleAlt, resolveBubble} from './charts-bubble.ts';
import type {BubbleOpts, BubblePoint} from './charts-bubble.ts';
import {butterflyAlt, resolveButterfly} from './charts-butterfly.ts';
import type {ButterflyOpts, ButterflyRow} from './charts-butterfly.ts';
import {comboAlt, resolveCombo} from './charts-combo.ts';
import type {ComboOpts, ComboSeries} from './charts-combo.ts';
import {harveyAlt, resolveHarvey} from './charts-harvey.ts';
import type {HarveyOpts, HarveyRow} from './charts-harvey.ts';
import {fail} from './charts-base.ts';
import {resolveIcon} from './icon-registry.ts';
import type {ChartBand} from './charts.ts';
import type {ChartOpts} from './charts-base.ts';

function common(who: string, opts: ChartOpts): Pick<ChartBand, 'id' | 'width' | 'height' | 'labelRole' | 'scope' | 'reveal' | 'until'> {
  assertScope(opts.scope, `${who}()`);
  if (opts.labelRole !== undefined && !['note', 'banner', 'stat'].includes(opts.labelRole)) fail(who, `labelRole must be note, banner or stat (got ${String(opts.labelRole)})`);
  for (const k of ['width', 'height'] as const) if (opts[k] !== undefined && !(Number.isFinite(opts[k]) && (opts[k] as number) > 0)) fail(who, `${k} must be a number > 0 (got ${opts[k]})`);
  return {
    ...(opts.id === undefined ? {} : {id: opts.id}), ...(opts.width === undefined ? {} : {width: opts.width}), ...(opts.height === undefined ? {} : {height: opts.height}),
    ...(opts.labelRole === undefined ? {} : {labelRole: opts.labelRole}), ...(opts.scope === undefined ? {} : {scope: opts.scope}), ...(opts.reveal === undefined ? {} : {reveal: opts.reveal}), ...(opts.until === undefined ? {} : {until: opts.until}),
  };
}

export function waterfallBand(steps: readonly WaterfallStep[], opts: WaterfallOpts = {}): ChartBand {
  const spec = resolveWaterfall(steps, opts);
  return {type: 'chart', kind: 'waterfall', spec, alt: opts.alt ?? waterfallAlt(spec), ids: steps.flatMap(s => s.id ? [s.id] : []), ...common('waterfall', opts)};
}

export function tornadoBand(items: readonly TornadoItem[], opts: TornadoOpts): ChartBand {
  const spec = resolveTornado(items, opts);
  return {type: 'chart', kind: 'tornado', spec, alt: opts.alt ?? tornadoAlt(spec), ids: spec.items.flatMap(i => i.id ? [i.id] : []), ...common('tornado', opts)};
}

export function heatmapBand(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts: HeatmapOpts): ChartBand {
  const spec = resolveHeatmap(rows, cols, values, opts);
  return {type: 'chart', kind: 'heatmap', spec, alt: opts.alt ?? heatmapAlt(spec), ids: [], ...common('heatmap', opts)};
}

export function stackedBand(who: string, columns: readonly StackColumn[], mode: StackMode, opts: StackedOpts): ChartBand {
  const spec = resolveStacked(who, columns, mode, opts);
  return {type: 'chart', kind: 'stacked', spec, alt: opts.alt ?? stackedAlt(spec), ids: columns.flatMap(c => c.id ? [c.id] : []), ...common(who, opts)};
}

export function radarBand(axes: readonly string[], series: readonly RadarSeries[], opts: RadarOpts): ChartBand {
  const spec = resolveRadar(axes, series, opts);
  return {type: 'chart', kind: 'radar', spec, alt: opts.alt ?? radarAlt(spec), ids: series.flatMap(s => s.id ? [s.id] : []), ...common('radar', opts)};
}

export function treemapBand(tree: TreemapNode | readonly TreemapNode[], opts: TreemapOpts): ChartBand {
  const spec = resolveTreemap(tree, opts);
  const ids: string[] = [];
  const walk = (n: TreemapNode): void => { if (n.id) ids.push(n.id); n.children?.forEach(walk); };
  spec.nodes.forEach(walk);
  return {type: 'chart', kind: 'treemap', spec, alt: opts.alt ?? treemapAlt(spec), ids, ...common('treemap', opts)};
}

export function sankeyBand(nodes: readonly (SankeyNode | string)[], links: readonly SankeyLink[], opts: SankeyOpts): ChartBand {
  // an icon is resolved here (the shell) and carried on the node, so layout and emit stay free of I/O
  const placed = nodes.map(n => typeof n === 'string' || n.icon === undefined ? n : {...n, iconGlyph: resolveIcon(n.icon, 'sankey() node "' + n.id + '" icon')});
  const spec = resolveSankey(placed, links, opts);
  return {type: 'chart', kind: 'sankey', spec, alt: opts.alt ?? sankeyAlt(spec), ids: spec.nodes.map(n => n.id), ...common('sankey', opts)};
}

export function catBand(who: string, data: readonly CatGroup[] | Readonly<Record<string, readonly number[]>>, opts: CatOpts, kind?: CatKind): ChartBand {
  const spec = resolveCat(who, data, opts, kind);
  return {type: 'chart', kind: 'catplot', spec, alt: opts.alt ?? catAlt(spec), ids: spec.groups.flatMap(g => g.id ? [g.id] : []), ...common(who, opts)};
}

export function distBand(who: string, data: readonly number[] | readonly DistGroup[] | Readonly<Record<string, readonly number[]>>, opts: DistOpts, kind: DistKind): ChartBand {
  const spec = resolveDist(who, data, opts, kind);
  return {type: 'chart', kind: 'distplot', spec, alt: opts.alt ?? distAlt(spec), ids: spec.groups.flatMap(g => g.id ? [g.id] : []), ...common(who, opts)};
}

export function multiBand(who: string, mode: MultiMode, data: XY | Readonly<Record<string, readonly number[]>>, opts: MultiOpts): ChartBand {
  const spec = resolveMulti(who, mode, data, opts);
  return {type: 'chart', kind: 'multiplot', spec, alt: opts.alt ?? multiAlt(spec), ids: [], ...common(who, opts)};
}

export function regBand(who: string, resid: boolean, data: RegData, opts: RegOpts): ChartBand {
  const spec = resolveReg(who, resid, data, opts);
  return {type: 'chart', kind: 'regplot', spec, alt: opts.alt ?? regAlt(spec), ids: [], ...common(who, opts)};
}

export function clusterBand(rows: readonly string[], cols: readonly string[], values: readonly (readonly number[])[], opts: ClusterOpts): ChartBand {
  const spec = resolveCluster(rows, cols, values, opts);
  return {type: 'chart', kind: 'clustermap', spec, alt: opts.alt ?? clusterAlt(spec), ids: [], ...common('clustermap', opts)};
}

export function bubbleBand(points: readonly BubblePoint[], opts: BubbleOpts): ChartBand {
  const spec = resolveBubble(points, opts);
  return {type: 'chart', kind: 'bubble', spec, alt: opts.alt ?? bubbleAlt(spec), ids: points.flatMap(p => p.id ? [p.id] : []), ...common('bubble', opts)};
}

export function butterflyBand(rows: readonly ButterflyRow[], opts: ButterflyOpts): ChartBand {
  const spec = resolveButterfly(rows, opts);
  return {type: 'chart', kind: 'butterfly', spec, alt: opts.alt ?? butterflyAlt(spec), ids: spec.rows.flatMap(r => r.id ? [r.id] : []), ...common('butterfly', opts)};
}

export function comboBand(categories: readonly string[], series: readonly ComboSeries[], opts: ComboOpts): ChartBand {
  const spec = resolveCombo(categories, series, opts);
  return {type: 'chart', kind: 'combo', spec, alt: opts.alt ?? comboAlt(spec), ids: series.flatMap(s => s.id ? [s.id] : []), ...common('combo', opts)};
}

export function harveyBand(rows: readonly HarveyRow[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts: HarveyOpts): ChartBand {
  const spec = resolveHarvey(rows, cols, values, opts);
  return {type: 'chart', kind: 'harvey', spec, alt: opts.alt ?? harveyAlt(spec), ids: spec.rowIds.flatMap(i => i ? [i] : []), ...common('harvey', opts)};
}
