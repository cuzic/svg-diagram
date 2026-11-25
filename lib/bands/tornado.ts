import {chartSpotlight, emitSpotlightChart} from '../emit-spotlight-chart.ts';
import {selectedAxisFindings} from '../axis-selected.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutTornado, tornadoTexts, tornadoValueAxis} from '../charts-tornado.ts';
import type {TornadoItem, TornadoOpts, TornadoSpec} from '../charts-tornado.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {tornado as build} from '../dsl/tornado.ts';
import {describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  selfDimming: true,
  spotlight: chartSpotlight,
  describe: describeChart,
  valueAxis: data => tornadoValueAxis(data.spec as TornadoSpec),
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, tornadoTexts(data.spec as TornadoSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutTornado(data.spec as TornadoSpec, geom)),
  emit: emitSpotlightChart,
  verify: {...verifyChart, diagramFindings: selectedAxisFindings},
} satisfies BandDef<ChartBand, LaidOutChart>;

export function tornado<const I extends readonly TornadoItem[], const Id extends string = never>(
  items: I, opts: TornadoOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<I, Id>>, LaidOutChart> {
  const data = build<I, Id>(items, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const tornadoDefinition: BandDef<ChartBand, LaidOutChart> = definition;
