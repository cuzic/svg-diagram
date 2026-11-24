import {edgeBendFindings} from '../verify-edge-bends.ts';
import type {PertTask} from '../semnet-critical-path.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutPert, pertTexts} from '../semnet-pert.ts';
import type {PertOpts, PertSpec} from '../semnet-pert.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {pert as build} from '../dsl/pert.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, pertTexts(data.spec as PertSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutPert(data.spec as PertSpec, geom)),
  emit: emitChart,
  verify: {...verifyChart, diagramFindings: edgeBendFindings},
} satisfies BandDef<ChartBand, LaidOutChart>;

export function pert<const T extends readonly PertTask[], const Id extends string = never>(
  tasks: T, opts?: PertOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<T, Id>>, LaidOutChart> {
  const data = build<T, Id>(tasks, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const pertDefinition: BandDef<ChartBand, LaidOutChart> = definition;
