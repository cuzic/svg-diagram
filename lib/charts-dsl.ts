// The band constructors behind waterfall(), radar(), heatmap(), ...: validate the data, work out the description, build the band.
// dsl.ts wraps each in a typed function that adds the handle (`.right`, `.at()`) and the typed anchor ids.
import {chartBandOptions} from './chart-band-options.ts';
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
import {bubbleAlt, resolveBubble} from './charts-bubble.ts';
import type {BubbleOpts, BubblePoint} from './charts-bubble.ts';
import {butterflyAlt, resolveButterfly} from './charts-butterfly.ts';
import type {ButterflyOpts, ButterflyRow} from './charts-butterfly.ts';
import {comboAlt, resolveCombo} from './charts-combo.ts';
import type {ComboOpts, ComboSeries} from './charts-combo.ts';
import {harveyAlt, resolveHarvey} from './charts-harvey.ts';
import type {HarveyCell, HarveyOpts, HarveyRow} from './charts-harvey.ts';
import {compareAlt, resolveCompare} from './charts-compare.ts';
import type {CompareCell, CompareOpts} from './charts-compare.ts';
import {resolveIcon} from './icon-registry.ts';
import type {ChartBand} from './charts.ts';

export function waterfallBand(steps: readonly WaterfallStep[], opts: WaterfallOpts = {}): ChartBand {
  const spec = resolveWaterfall(steps, opts);
  return {type: 'chart', kind: 'waterfall', spec, alt: opts.alt ?? waterfallAlt(spec), ids: steps.flatMap(s => s.id ? [s.id] : []), ...chartBandOptions('waterfall', opts)};
}

export function tornadoBand(items: readonly TornadoItem[], opts: TornadoOpts): ChartBand {
  const spec = resolveTornado(items, opts);
  return {type: 'chart', kind: 'tornado', spec, alt: opts.alt ?? tornadoAlt(spec), ids: spec.items.flatMap(i => i.id ? [i.id] : []), ...chartBandOptions('tornado', opts)};
}

export function heatmapBand(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts: HeatmapOpts): ChartBand {
  const spec = resolveHeatmap(rows, cols, values, opts);
  return {type: 'chart', kind: 'heatmap', spec, alt: opts.alt ?? heatmapAlt(spec), ids: [], ...chartBandOptions('heatmap', opts)};
}

export function stackedBand(who: string, columns: readonly StackColumn[], mode: StackMode, opts: StackedOpts): ChartBand {
  const spec = resolveStacked(who, columns, mode, opts);
  return {type: 'chart', kind: 'stacked', spec, alt: opts.alt ?? stackedAlt(spec), ids: columns.flatMap(c => c.id ? [c.id] : []), ...chartBandOptions(who, opts)};
}

export function radarBand(axes: readonly string[], series: readonly RadarSeries[], opts: RadarOpts): ChartBand {
  const spec = resolveRadar(axes, series, opts);
  return {type: 'chart', kind: 'radar', spec, alt: opts.alt ?? radarAlt(spec), ids: series.flatMap(s => s.id ? [s.id] : []), ...chartBandOptions('radar', opts)};
}

export function treemapBand(tree: TreemapNode | readonly TreemapNode[], opts: TreemapOpts): ChartBand {
  const spec = resolveTreemap(tree, opts);
  const ids: string[] = [];
  const walk = (n: TreemapNode): void => { if (n.id) ids.push(n.id); n.children?.forEach(walk); };
  spec.nodes.forEach(walk);
  return {type: 'chart', kind: 'treemap', spec, alt: opts.alt ?? treemapAlt(spec), ids, ...chartBandOptions('treemap', opts)};
}

export function sankeyBand(nodes: readonly (SankeyNode | string)[], links: readonly SankeyLink[], opts: SankeyOpts): ChartBand {
  // an icon is resolved here (the shell) and carried on the node, so layout and emit stay free of I/O
  const placed = nodes.map(n => typeof n === 'string' || n.icon === undefined ? n : {...n, iconGlyph: resolveIcon(n.icon, 'sankey() node "' + n.id + '" icon')});
  const spec = resolveSankey(placed, links, opts);
  return {type: 'chart', kind: 'sankey', spec, alt: opts.alt ?? sankeyAlt(spec), ids: spec.nodes.map(n => n.id), ...chartBandOptions('sankey', opts)};
}

export function bubbleBand(points: readonly BubblePoint[], opts: BubbleOpts): ChartBand {
  const spec = resolveBubble(points, opts);
  return {type: 'chart', kind: 'bubble', spec, alt: opts.alt ?? bubbleAlt(spec), ids: points.flatMap(p => p.id ? [p.id] : []), ...chartBandOptions('bubble', opts)};
}

export function butterflyBand(rows: readonly ButterflyRow[], opts: ButterflyOpts): ChartBand {
  const spec = resolveButterfly(rows, opts);
  return {type: 'chart', kind: 'butterfly', spec, alt: opts.alt ?? butterflyAlt(spec), ids: spec.rows.flatMap(r => r.id ? [r.id] : []), ...chartBandOptions('butterfly', opts)};
}

export function comboBand(categories: readonly string[], series: readonly ComboSeries[], opts: ComboOpts): ChartBand {
  const spec = resolveCombo(categories, series, opts);
  return {type: 'chart', kind: 'combo', spec, alt: opts.alt ?? comboAlt(spec), ids: series.flatMap(s => s.id ? [s.id] : []), ...chartBandOptions('combo', opts)};
}

export function harveyBand(rows: readonly HarveyRow[], cols: readonly string[], values: readonly (readonly HarveyCell[])[], opts: HarveyOpts): ChartBand {
  const spec = resolveHarvey(rows, cols, values, opts);
  return {type: 'chart', kind: 'harvey', spec, alt: opts.alt ?? harveyAlt(spec), ids: spec.rowIds.flatMap(i => i ? [i] : []), ...chartBandOptions('harvey', opts)};
}

export function compareBand(rows: readonly string[], cols: readonly string[], cells: readonly (readonly CompareCell[])[], opts: CompareOpts): ChartBand {
  const spec = resolveCompare(rows, cols, cells, opts);
  return {type: 'chart', kind: 'compare', spec, alt: opts.alt ?? compareAlt(spec), ids: [], ...chartBandOptions('compare', opts)};
}
