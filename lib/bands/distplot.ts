import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutDist, distTexts} from '../charts-dist.ts';
import type {DistGroup, DistOpts, DistSpec} from '../charts-dist.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {displot as buildDisplot, histplot as buildHistplot, kdeplot as buildKdeplot, ecdfplot as buildEcdfplot, rugplot as buildRugplot} from '../dsl/charts-stats.ts';
import {chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, distTexts(data.spec as DistSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutDist(data.spec as DistSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

type DistData = readonly number[] | readonly DistGroup[] | Readonly<Record<string, readonly number[]>>;

export function displot<const D extends DistData, const Id extends string = never>(
  data: D, opts?: DistOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildDisplot<D, Id>>, LaidOutChart> {
  const chart = buildDisplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function histplot<const D extends DistData, const Id extends string = never>(
  data: D, opts?: Omit<DistOpts, 'kind'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildHistplot<D, Id>>, LaidOutChart> {
  const chart = buildHistplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function kdeplot<const D extends DistData, const Id extends string = never>(
  data: D, opts?: Omit<DistOpts, 'kind'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildKdeplot<D, Id>>, LaidOutChart> {
  const chart = buildKdeplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function ecdfplot<const D extends DistData, const Id extends string = never>(
  data: D, opts?: Omit<DistOpts, 'kind'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildEcdfplot<D, Id>>, LaidOutChart> {
  const chart = buildEcdfplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function rugplot<const D extends DistData, const Id extends string = never>(
  data: D, opts?: Omit<DistOpts, 'kind'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildRugplot<D, Id>>, LaidOutChart> {
  const chart = buildRugplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}
