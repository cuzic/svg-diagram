import {texts} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {valueChain as build} from '../dsl/flow.ts';
import {emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow} from '../flow-definition.ts';
import {valueChainTexts, layoutValueChain} from '../flow-shapes.ts';
import type {ValueChainBand, ValueChainOpts, FlowStep, LaidOutFlowShape} from '../flow-shapes.ts';

const definition = {
  type: 'valueChain',
  title: data => [2, data.primary[0]?.label],
  textSizes: texts,
  ids: data => flowItemIds([...data.support, ...data.primary]),
  measure: (data, env) => measureFlow(data, env, valueChainTexts),
  layout: (data, env) => placeFlow(data, env, layoutValueChain),
  emit: emitFlow,
  verify: verifyFlow,
} satisfies BandDef<ValueChainBand, LaidOutFlowShape>;

export function valueChain<const Id extends string = never, const S extends readonly (string | FlowStep)[] = readonly (string | FlowStep)[], const P extends readonly (string | FlowStep)[] = readonly (string | FlowStep)[]>(parts: {support?: S; primary: P}, opts?: ValueChainOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id, S, P>>, LaidOutFlowShape> {
  const data = build<Id, S, P>(parts, opts);
  return band<typeof data, LaidOutFlowShape>(definition, data);
}
