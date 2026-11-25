import {chartSpotlight, emitSpotlightChart} from '../emit-spotlight-chart.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutCompare, compareTexts} from '../charts-compare.ts';
import type {CompareCell, CompareOpts, CompareSpec} from '../charts-compare.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {compare as build} from '../dsl/compare.ts';
import {describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  selfDimming: true,
  spotlight: chartSpotlight,
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, compareTexts(data.spec as CompareSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutCompare(data.spec as CompareSpec, geom)),
  emit: emitSpotlightChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function compare<const Id extends string = never>(
  rows: readonly string[], cols: readonly string[], cells: readonly (readonly CompareCell[])[], opts?: CompareOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<Id>>, LaidOutChart> {
  const data = build<Id>(rows, cols, cells, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const compareDefinition: BandDef<ChartBand, LaidOutChart> = definition;
