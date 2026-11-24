import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutTreemap, treemapTexts} from '../charts-treemap.ts';
import type {TreemapNode, TreemapOpts, TreemapSpec} from '../charts-treemap.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {treemap as build} from '../dsl/charts.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, treemapTexts(data.spec as TreemapSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutTreemap(data.spec as TreemapSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function treemap<const T extends TreemapNode | readonly TreemapNode[], const Id extends string = never>(
  tree: T, opts?: TreemapOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<T, Id>>, LaidOutChart> {
  const data = build<T, Id>(tree, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}
