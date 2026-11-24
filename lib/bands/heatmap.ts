import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutHeatmap, heatmapTexts} from '../charts-heatmap.ts';
import type {HeatmapOpts, HeatmapSpec} from '../charts-heatmap.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {heatmap as build} from '../dsl/charts.ts';
import {chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, heatmapTexts(data.spec as HeatmapSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutHeatmap(data.spec as HeatmapSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function heatmap<const Id extends string = never>(
  rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts?: HeatmapOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<Id>>, LaidOutChart> {
  const data = build<Id>(rows, cols, values, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}
