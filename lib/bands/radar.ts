import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutRadar, radarTexts} from '../charts-radar.ts';
import type {RadarOpts, RadarSpec, RadarSeries} from '../charts-radar.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {radar as build} from '../dsl/radar.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, radarTexts(data.spec as RadarSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutRadar(data.spec as RadarSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function radar<const S extends readonly RadarSeries[], const Id extends string = never>(axes: readonly string[], series: S, opts?: RadarOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<S, Id>>, LaidOutChart> {
  const data = build<S, Id>(axes, series, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const radarDefinition: BandDef<ChartBand, LaidOutChart> = definition;
