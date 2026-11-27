import {flowSpotlight} from '../emit-flow-shape.ts';
import {nameFlowShapeNodes} from '../emit-node-ids.ts';
import {figureRects} from '../verify-rects.ts';
import {texts} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {cycle as build} from '../dsl/cycle.ts';
import {emitFlow, flowItemIds, measureFlow, verifyFlow} from '../flow-definition.ts';
import {growTexts, placeGrown, cycleFits} from '../flow-grow.ts';
import {cycleTexts, layoutCycleShape} from '../flow-cycle.ts';
import type {CycleBand, CycleOpts, FlowStep, LaidOutFlowShape} from '../flow-shapes.ts';

const definition = {
  type: 'cycle',
  selfDimming: true,
  spotlight: flowSpotlight,
  title: data => [2, data.steps[0]?.label],
  textSizes: texts,
  ids: data => flowItemIds(data.steps),
  measure: (data, env) => measureFlow(data, env, growTexts(cycleTexts)),
  layout: (data, env) => placeGrown(data, env, layoutCycleShape, cycleFits),
  emit: emitFlow,
  nameNodes: nameFlowShapeNodes,
  svgDefs: () => ({arrow: true}),
  verify: {...verifyFlow, rects: figureRects},
} satisfies BandDef<CycleBand, LaidOutFlowShape>;

export function cycle<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: CycleOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id, I>>, LaidOutFlowShape> {
  const data = build<Id, I>(steps, opts);
  return band<typeof data, LaidOutFlowShape>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const cycleDefinition: BandDef<CycleBand, LaidOutFlowShape> = definition;
