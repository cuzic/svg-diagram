import {chartSpotlight, emitSpotlightChart} from '../emit-spotlight-chart.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutHeatmap, heatmapTexts} from '../charts-heatmap.ts';
import type {HeatmapOpts, HeatmapSpec} from '../charts-heatmap.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {heatmap as build} from '../dsl/heatmap.ts';
import {describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  selfDimming: true,
  spotlight: chartSpotlight,
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, heatmapTexts(data.spec as HeatmapSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutHeatmap(data.spec as HeatmapSpec, geom)),
  emit: emitSpotlightChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function heatmap<const Id extends string = never>(
  rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts?: HeatmapOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<Id>>, LaidOutChart> {
  const data = build<Id>(rows, cols, values, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const heatmapDefinition: BandDef<ChartBand, LaidOutChart> = definition;
