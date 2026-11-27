import {flowSpotlight} from '../emit-flow-shape.ts';
import {nameFlowShapeNodes} from '../emit-node-ids.ts';
import {overlappingFigureRects} from '../verify-rects.ts';
import {texts} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {venn as build} from '../dsl/venn.ts';
import {emitFlow, flowItemIds, measureFlow, verifyFlow} from '../flow-definition.ts';
import {growTexts, placeGrown, vennFits} from '../flow-grow.ts';
import {vennTexts, layoutVenn} from '../flow-venn.ts';
import type {VennBand, VennOpts, VennSet, LaidOutFlowShape} from '../flow-shapes.ts';

const definition = {
  type: 'venn',
  selfDimming: true,
  spotlight: flowSpotlight,
  title: data => [2, data.sets.map(set => set.label ?? set.name).join('・')],
  textSizes: texts,
  ids: data => flowItemIds(data.sets),
  measure: (data, env) => measureFlow(data, env, growTexts(vennTexts)),
  layout: (data, env) => placeGrown(data, env, layoutVenn, vennFits),
  emit: emitFlow,
  nameNodes: nameFlowShapeNodes,
  verify: {...verifyFlow, rects: overlappingFigureRects},
} satisfies BandDef<VennBand, LaidOutFlowShape>;

export function venn<const Id extends string = never, const I extends readonly VennSet[] = readonly VennSet[]>(sets: I, opts?: VennOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id, I>>, LaidOutFlowShape> {
  const data = build<Id, I>(sets, opts);
  return band<typeof data, LaidOutFlowShape>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const vennDefinition: BandDef<VennBand, LaidOutFlowShape> = definition;
