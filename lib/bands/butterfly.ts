import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutButterfly, butterflyTexts} from '../charts-butterfly.ts';
import type {ButterflyRow, ButterflyOpts, ButterflySpec} from '../charts-butterfly.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {butterfly as build} from '../dsl/charts.ts';
import {chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, butterflyTexts(data.spec as ButterflySpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutButterfly(data.spec as ButterflySpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function butterfly<const R extends readonly ButterflyRow[], const Id extends string = never>(
  rows: R, opts: ButterflyOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<R, Id>>, LaidOutChart> {
  const data = build<R, Id>(rows, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}
