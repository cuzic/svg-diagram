import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutMulti, multiTexts} from '../charts-multi.ts';
import type {MultiOpts, MultiSpec, XY} from '../charts-multi.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {hist2d as buildHist2d, jointplot as buildJointplot, kde2d as buildKde2d, pairplot as buildPairplot} from '../dsl/multiplot.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, multiTexts(data.spec as MultiSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutMulti(data.spec as MultiSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function hist2d<const Id extends string = never>(
  data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildHist2d<Id>>, LaidOutChart> {
  const chart = buildHist2d<Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function jointplot<const Id extends string = never>(
  data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildJointplot<Id>>, LaidOutChart> {
  const chart = buildJointplot<Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function kde2d<const Id extends string = never>(
  data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildKde2d<Id>>, LaidOutChart> {
  const chart = buildKde2d<Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function pairplot<const Id extends string = never>(
  data: XY | Readonly<Record<string, readonly number[]>>, opts?: MultiOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildPairplot<Id>>, LaidOutChart> {
  const chart = buildPairplot<Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

/** @internal Definition used by the full renderer. */
export const multiplotDefinition: BandDef<ChartBand, LaidOutChart> = definition;
