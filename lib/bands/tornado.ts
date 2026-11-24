import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutTornado, tornadoTexts} from '../charts-tornado.ts';
import type {TornadoItem, TornadoOpts, TornadoSpec} from '../charts-tornado.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {tornado as build} from '../dsl/charts.ts';
import {chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, tornadoTexts(data.spec as TornadoSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutTornado(data.spec as TornadoSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function tornado<const I extends readonly TornadoItem[], const Id extends string = never>(
  items: I, opts: TornadoOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<I, Id>>, LaidOutChart> {
  const data = build<I, Id>(items, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}
