import {chartSpotlight, emitSpotlightChart} from '../emit-spotlight-chart.ts';
import {edgeBendFindings} from '../verify-edge-bends.ts';
import type {CausalLink} from '../semnet-causal-loops.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutCausal, causalTexts} from '../semnet-causal.ts';
import type {CausalIntervention, CausalNode, CausalOpts, CausalSpec} from '../semnet-causal.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {causalLoop as build} from '../dsl/causal.ts';
import {describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  selfDimming: true,
  spotlight: chartSpotlight,
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, causalTexts(data.spec as CausalSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutCausal(data.spec as CausalSpec, geom)),
  emit: emitSpotlightChart,
  verify: {...verifyChart, diagramFindings: edgeBendFindings},
} satisfies BandDef<ChartBand, LaidOutChart>;

export function causalLoop<const N extends readonly CausalNode[], const I extends readonly CausalIntervention[] = readonly [], const Id extends string = never>(
  nodes: N, links: readonly CausalLink[], opts?: Omit<CausalOpts, 'interventions'> & {interventions?: I} & {id?: Id},
): WithBandDef<ReturnType<typeof build<N, I, Id>>, LaidOutChart> {
  const data = build<N, I, Id>(nodes, links, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const causalDefinition: BandDef<ChartBand, LaidOutChart> = definition;
