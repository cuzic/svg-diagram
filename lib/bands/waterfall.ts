import {selectedAxisFindings} from '../axis-selected.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutWaterfall, waterfallTexts, waterfallValueAxis} from '../charts-waterfall.ts';
import type {WaterfallOpts, WaterfallSpec, WaterfallStep} from '../charts-waterfall.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {waterfall as build} from '../dsl/waterfall.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  valueAxis: data => waterfallValueAxis(data.spec as WaterfallSpec),
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, waterfallTexts(data.spec as WaterfallSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutWaterfall(data.spec as WaterfallSpec, geom)),
  emit: emitChart,
  verify: {...verifyChart, diagramFindings: selectedAxisFindings},
} satisfies BandDef<ChartBand, LaidOutChart>;

export function waterfall<const S extends readonly WaterfallStep[], const Id extends string = never>(steps: S, opts?: WaterfallOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<S, Id>>, LaidOutChart> {
  const data = build<S, Id>(steps, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const waterfallDefinition: BandDef<ChartBand, LaidOutChart> = definition;
