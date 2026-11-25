import { flowSpotlight } from '../emit-flow-shape.js';
import { nameFlowShapeNodes } from '../emit-node-ids.js';
import { emblemRects } from '../verify-rects.js';
import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { emblem as build } from '../dsl/emblem.js';
import { emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow } from '../flow-definition.js';
import { emblemTexts, layoutEmblem } from '../flow-emblem.js';
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
    nameNodes: nameFlowShapeNodes,
    verify: { ...verifyFlow, rects: emblemRects, tones: data => data.items.map(item => item.tone ?? 'plain') },
};
export function emblem(items, opts) {
    const data = typeof items === 'string' ? build(items, opts) : build(items, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const emblemDefinition = definition;
