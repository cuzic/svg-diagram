import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {emblem as build} from '../dsl/flow.ts';
import {emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow} from '../flow-definition.ts';
import {emblemTexts, layoutEmblem} from '../flow-shapes.ts';
import type {EmblemBand, EmblemOpts, EmblemItem, LaidOutFlowShape} from '../flow-shapes.ts';

const definition = {
  type: 'emblem',
  ids: data => flowItemIds(data.items),
  measure: (data, env) => measureFlow(data, env, emblemTexts),
  layout: (data, env) => placeFlow(data, env, layoutEmblem),
  emit: emitFlow,
  verify: verifyFlow,
} satisfies BandDef<EmblemBand, LaidOutFlowShape>;

export function emblem(items: string | readonly EmblemItem[], opts?: (Omit<EmblemItem, 'label'> & EmblemOpts)): WithBandDef<EmblemBand, LaidOutFlowShape> {
  const data = typeof items === 'string' ? build(items, opts) : build(items, opts);
  return band<EmblemBand, LaidOutFlowShape>(definition, data);
}
