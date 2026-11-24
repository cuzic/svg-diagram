import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutCat, catTexts} from '../charts-cat.ts';
import type {CatGroup, CatOpts, CatSpec} from '../charts-cat.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {catplot as buildCatplot, boxplot as buildBoxplot, violinplot as buildViolinplot, stripplot as buildStripplot, swarmplot as buildSwarmplot, pointplot as buildPointplot, barplot as buildBarplot} from '../dsl/catplot.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, catTexts(data.spec as CatSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutCat(data.spec as CatSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

type CatData = readonly CatGroup[] | Readonly<Record<string, readonly number[]>>;

export function catplot<const D extends CatData, const Id extends string = never>(
  data: D, opts?: CatOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildCatplot<D, Id>>, LaidOutChart> {
  const chart = buildCatplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function boxplot<const D extends CatData, const Id extends string = never>(
  data: D, opts?: Omit<CatOpts, 'kind'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildBoxplot<D, Id>>, LaidOutChart> {
  const chart = buildBoxplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function violinplot<const D extends CatData, const Id extends string = never>(
  data: D, opts?: Omit<CatOpts, 'kind'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildViolinplot<D, Id>>, LaidOutChart> {
  const chart = buildViolinplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function stripplot<const D extends CatData, const Id extends string = never>(
  data: D, opts?: Omit<CatOpts, 'kind'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildStripplot<D, Id>>, LaidOutChart> {
  const chart = buildStripplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function swarmplot<const D extends CatData, const Id extends string = never>(
  data: D, opts?: Omit<CatOpts, 'kind'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildSwarmplot<D, Id>>, LaidOutChart> {
  const chart = buildSwarmplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function pointplot<const D extends CatData, const Id extends string = never>(
  data: D, opts?: Omit<CatOpts, 'kind'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildPointplot<D, Id>>, LaidOutChart> {
  const chart = buildPointplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function barplot<const D extends CatData, const Id extends string = never>(
  data: D, opts?: Omit<CatOpts, 'kind'> & {id?: Id},
): WithBandDef<ReturnType<typeof buildBarplot<D, Id>>, LaidOutChart> {
  const chart = buildBarplot<D, Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}
