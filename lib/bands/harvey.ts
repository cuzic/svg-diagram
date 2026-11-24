import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutHarvey, harveyTexts} from '../charts-harvey.ts';
import type {HarveyCell, HarveyRow, HarveyOpts, HarveySpec} from '../charts-harvey.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {harvey as build} from '../dsl/charts.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, harveyTexts(data.spec as HarveySpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutHarvey(data.spec as HarveySpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function harvey<const R extends readonly HarveyRow[], const Id extends string = never>(
  rows: R, cols: readonly string[], values: readonly (readonly HarveyCell[])[], opts?: HarveyOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<R, Id>>, LaidOutChart> {
  const data = build<R, Id>(rows, cols, values, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}
