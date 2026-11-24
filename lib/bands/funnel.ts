import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {funnel as build} from '../dsl/flow.ts';
import {emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow} from '../flow-definition.ts';
import {funnelTexts, layoutFunnel} from '../flow-shapes.ts';
import type {FunnelBand, FunnelOpts, FunnelStage, LaidOutFlowShape} from '../flow-shapes.ts';

const definition = {
  type: 'funnel',
  ids: data => flowItemIds(data.stages),
  measure: (data, env) => measureFlow(data, env, funnelTexts),
  layout: (data, env) => placeFlow(data, env, layoutFunnel),
  emit: emitFlow,
  verify: verifyFlow,
} satisfies BandDef<FunnelBand, LaidOutFlowShape>;

export function funnel<const Id extends string = never, const I extends readonly FunnelStage[] = readonly FunnelStage[]>(stages: I, opts?: FunnelOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id, I>>, LaidOutFlowShape> {
  const data = build<Id, I>(stages, opts);
  return band<typeof data, LaidOutFlowShape>(definition, data);
}
