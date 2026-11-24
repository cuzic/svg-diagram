import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutCluster, clusterTexts} from '../charts-cluster.ts';
import type {ClusterOpts, ClusterSpec} from '../charts-cluster.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {clustermap as buildClustermap} from '../dsl/clustermap.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, clusterTexts(data.spec as ClusterSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutCluster(data.spec as ClusterSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function clustermap<const Id extends string = never>(
  rows: readonly string[], cols: readonly string[], values: readonly (readonly number[])[], opts?: ClusterOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildClustermap<Id>>, LaidOutChart> {
  const chart = buildClustermap<Id>(rows, cols, values, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

/** @internal Definition used by the full renderer. */
export const clustermapDefinition: BandDef<ChartBand, LaidOutChart> = definition;
