import {chevronLoopBack} from '../loop-back-source.ts';
import {figureRects} from '../verify-rects.ts';
import {texts} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {chevron as build} from '../dsl/chevron.ts';
import {emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow} from '../flow-definition.ts';
import {chevronTexts, layoutChevron} from '../flow-chevron.ts';
import type {ChevronBand, ChevronOpts, FlowStep, LaidOutFlowShape} from '../flow-shapes.ts';

const definition = {
  type: 'chevron',
  loopBackSource: chevronLoopBack,
  title: data => [2, data.steps[0]?.label],
  textSizes: texts,
  ids: data => flowItemIds(data.steps),
  measure: (data, env) => measureFlow(data, env, chevronTexts),
  layout: (data, env) => placeFlow(data, env, layoutChevron),
  emit: emitFlow,
  verify: {...verifyFlow, rects: figureRects},
} satisfies BandDef<ChevronBand, LaidOutFlowShape>;

export function chevron<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: ChevronOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id, I>>, LaidOutFlowShape> {
  const data = build<Id, I>(steps, opts);
  return band<typeof data, LaidOutFlowShape>(definition, data);
}
