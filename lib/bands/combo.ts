import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutCombo, comboTexts} from '../charts-combo.ts';
import type {ComboOpts, ComboSeries, ComboSpec} from '../charts-combo.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {combo as build} from '../dsl/charts.ts';
import {chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, comboTexts(data.spec as ComboSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutCombo(data.spec as ComboSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function combo<const S extends readonly ComboSeries[], const Id extends string = never>(
  categories: readonly string[], series: S, opts?: ComboOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<S, Id>>, LaidOutChart> {
  const data = build<S, Id>(categories, series, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}
