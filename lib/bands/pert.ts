import type {PertTask} from '../semnet-analysis.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutPert, pertTexts} from '../semnet-pert.ts';
import type {PertOpts, PertSpec} from '../semnet-pert.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {pert as build} from '../dsl/charts.ts';
import {chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, pertTexts(data.spec as PertSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutPert(data.spec as PertSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function pert<const T extends readonly PertTask[], const Id extends string = never>(
  tasks: T, opts?: PertOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<T, Id>>, LaidOutChart> {
  const data = build<T, Id>(tasks, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}
