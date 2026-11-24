import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutSankey, sankeyTexts} from '../charts-sankey.ts';
import type {SankeyOpts, SankeySpec, SankeyNode, SankeyLink} from '../charts-sankey.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {sankey as build} from '../dsl/sankey.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, sankeyTexts(data.spec as SankeySpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutSankey(data.spec as SankeySpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function sankey<const N extends readonly (SankeyNode | string)[], const Id extends string = never>(
  nodes: N, links: readonly SankeyLink[], opts?: SankeyOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<N, Id>>, LaidOutChart> {
  const data = build<N, Id>(nodes, links, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}
