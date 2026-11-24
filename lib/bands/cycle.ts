import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {cycle as build} from '../dsl/flow.ts';
import {emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow} from '../flow-definition.ts';
import {cycleTexts, layoutCycleShape} from '../flow-shapes.ts';
import type {CycleBand, CycleOpts, FlowStep, LaidOutFlowShape} from '../flow-shapes.ts';

const definition = {
  type: 'cycle',
  ids: data => flowItemIds(data.steps),
  measure: (data, env) => measureFlow(data, env, cycleTexts),
  layout: (data, env) => placeFlow(data, env, layoutCycleShape),
  emit: emitFlow,
  verify: verifyFlow,
} satisfies BandDef<CycleBand, LaidOutFlowShape>;

export function cycle<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: CycleOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id, I>>, LaidOutFlowShape> {
  const data = build<Id, I>(steps, opts);
  return band<typeof data, LaidOutFlowShape>(definition, data);
}
