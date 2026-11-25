import { flowSpotlight } from '../emit-flow-shape.js';
import { nameFlowShapeNodes } from '../emit-node-ids.js';
import { overlappingFigureRects } from '../verify-rects.js';
import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { venn as build } from '../dsl/venn.js';
import { emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow } from '../flow-definition.js';
import { vennTexts, layoutVenn } from '../flow-venn.js';
const definition = {
    type: 'venn',
    selfDimming: true,
    spotlight: flowSpotlight,
    title: data => [2, data.sets.map(set => set.label ?? set.name).join('・')],
    textSizes: texts,
    ids: data => flowItemIds(data.sets),
    measure: (data, env) => measureFlow(data, env, vennTexts),
    layout: (data, env) => placeFlow(data, env, layoutVenn),
    emit: emitFlow,
    nameNodes: nameFlowShapeNodes,
    verify: { ...verifyFlow, rects: overlappingFigureRects },
};
export function venn(sets, opts) {
    const data = build(sets, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const vennDefinition = definition;
