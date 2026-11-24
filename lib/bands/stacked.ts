import {selectedAxisFindings} from '../axis-selected.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutStacked, stackedTexts, stackedValueAxis} from '../charts-stacked.ts';
import type {StackColumn, StackedOpts, StackedSpec} from '../charts-stacked.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {stackedBars as buildStacked, mekko as buildMekko} from '../dsl/stacked.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  valueAxis: data => stackedValueAxis(data.spec as StackedSpec),
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, stackedTexts(data.spec as StackedSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutStacked(data.spec as StackedSpec, geom)),
  emit: emitChart,
  verify: {...verifyChart, diagramFindings: selectedAxisFindings},
} satisfies BandDef<ChartBand, LaidOutChart>;

export function stackedBars<const C extends readonly StackColumn[], const Id extends string = never>(
  columns: C, opts?: StackedOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildStacked<C, Id>>, LaidOutChart> {
  const data = buildStacked<C, Id>(columns, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

export function mekko<const C extends readonly StackColumn[], const Id extends string = never>(
  columns: C, opts?: Omit<StackedOpts, 'percent'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildMekko<C, Id>>, LaidOutChart> {
  const data = buildMekko<C, Id>(columns, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}
