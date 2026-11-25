import {flowSpotlight} from '../emit-flow-shape.ts';
import {emblemRects} from '../verify-rects.ts';
import {texts} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {emblem as build} from '../dsl/emblem.ts';
import {emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow} from '../flow-definition.ts';
import {emblemTexts, layoutEmblem} from '../flow-emblem.ts';
import type {EmblemBand, EmblemOpts, EmblemItem, LaidOutFlowShape} from '../flow-shapes.ts';

const definition = {
  type: 'emblem',
  selfDimming: true,
  spotlight: flowSpotlight,
  title: data => [2, data.items[0]?.label],
  textSizes: texts,
  ids: data => flowItemIds(data.items),
  measure: (data, env) => measureFlow(data, env, emblemTexts),
  layout: (data, env) => placeFlow(data, env, layoutEmblem),
  emit: emitFlow,
  verify: {...verifyFlow, rects: emblemRects, tones: data => data.items.map(item => item.tone ?? 'plain')},
} satisfies BandDef<EmblemBand, LaidOutFlowShape>;

export function emblem(items: string | readonly EmblemItem[], opts?: (Omit<EmblemItem, 'label'> & EmblemOpts)): WithBandDef<EmblemBand, LaidOutFlowShape> {
  const data = typeof items === 'string' ? build(items, opts) : build(items, opts);
  return band<EmblemBand, LaidOutFlowShape>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const emblemDefinition: BandDef<EmblemBand, LaidOutFlowShape> = definition;
