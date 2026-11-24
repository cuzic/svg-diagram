import {edgeBendFindings} from '../verify-edge-bends.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutDependency, dependencyTexts} from '../semnet-dependency.ts';
import type {DependencyEdge, DependencyNode, DependencyOpts, DependencySpec} from '../semnet-dependency.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {dependencyNetwork as build} from '../dsl/dependency.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, dependencyTexts(data.spec as DependencySpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutDependency(data.spec as DependencySpec, geom)),
  emit: emitChart,
  verify: {...verifyChart, diagramFindings: edgeBendFindings},
} satisfies BandDef<ChartBand, LaidOutChart>;

export function dependencyNetwork<const N extends readonly DependencyNode[], const Id extends string = never>(
  nodes: N, edges: readonly DependencyEdge[], opts?: DependencyOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<N, Id>>, LaidOutChart> {
  const data = build<N, Id>(nodes, edges, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const dependencyDefinition: BandDef<ChartBand, LaidOutChart> = definition;
