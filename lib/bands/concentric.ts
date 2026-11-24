import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {concentric as build} from '../dsl/flow.ts';
import {emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow} from '../flow-definition.ts';
import {concentricTexts, layoutConcentricShape} from '../flow-shapes.ts';
import type {ConcentricBand, ConcentricOpts, ConcentricRing, LaidOutFlowShape} from '../flow-shapes.ts';

const definition = {
  type: 'concentric',
  ids: data => flowItemIds([...data.rings, ...data.sectors ?? [], ...data.marks ?? []]),
  measure: (data, env) => measureFlow(data, env, concentricTexts),
  layout: (data, env) => placeFlow(data, env, layoutConcentricShape),
  emit: emitFlow,
  svgDefs: laid => ({arrow: laid.primitives.some(p => p.k === 'path' && !!p.arrow)}),
  verify: verifyFlow,
} satisfies BandDef<ConcentricBand, LaidOutFlowShape>;

export function concentric(rings: readonly ConcentricRing[] | number, opts?: ConcentricOpts): WithBandDef<ConcentricBand, LaidOutFlowShape> {
  const data = typeof rings === 'number'
    ? build(rings, opts as ConcentricOpts & {sectors: NonNullable<ConcentricOpts['sectors']>})
    : build(rings, opts);
  return band<ConcentricBand, LaidOutFlowShape>(definition, data);
}
