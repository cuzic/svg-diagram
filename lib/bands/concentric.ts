import {flowSpotlight} from '../emit-flow-shape.ts';
import {concentricFindings} from '../verify-concentric.ts';
import {overlappingFigureRects} from '../verify-rects.ts';
import {texts} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {concentric as build} from '../dsl/concentric.ts';
import {emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow} from '../flow-definition.ts';
import {concentricTexts, layoutConcentricShape} from '../flow-concentric.ts';
import type {ConcentricBand, ConcentricOpts, ConcentricRing, LaidOutFlowShape} from '../flow-shapes.ts';

const definition = {
  type: 'concentric',
  selfDimming: true,
  spotlight: flowSpotlight,
  title: data => [2, data.centre ?? data.rings[0]?.label],
  textSizes: texts,
  ids: data => flowItemIds([...data.rings, ...data.sectors ?? [], ...data.marks ?? []]),
  measure: (data, env) => measureFlow(data, env, concentricTexts),
  layout: (data, env) => placeFlow(data, env, layoutConcentricShape),
  emit: emitFlow,
  svgDefs: laid => ({arrow: laid.primitives.some(p => p.k === 'path' && !!p.arrow)}),
  verify: {...verifyFlow, rects: overlappingFigureRects, layoutFindings: concentricFindings},
} satisfies BandDef<ConcentricBand, LaidOutFlowShape>;

export function concentric(rings: readonly ConcentricRing[] | number, opts?: ConcentricOpts): WithBandDef<ConcentricBand, LaidOutFlowShape> {
  const data = typeof rings === 'number'
    ? build(rings, opts as ConcentricOpts & {sectors: NonNullable<ConcentricOpts['sectors']>})
    : build(rings, opts);
  return band<ConcentricBand, LaidOutFlowShape>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const concentricDefinition: BandDef<ConcentricBand, LaidOutFlowShape> = definition;
