import { flowSpotlight } from '../emit-flow-shape.js';
import { nameFlowShapeNodes } from '../emit-node-ids.js';
import { figureRects } from '../verify-rects.js';
import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { valueChain as build } from '../dsl/value-chain.js';
import { emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow } from '../flow-definition.js';
import { valueChainTexts, layoutValueChain } from '../flow-value-chain.js';
const definition = {
    type: 'valueChain',
    selfDimming: true,
    spotlight: flowSpotlight,
    title: data => [2, data.primary[0]?.label],
    textSizes: texts,
    ids: data => flowItemIds([...data.support, ...data.primary]),
    measure: (data, env) => measureFlow(data, env, valueChainTexts),
    layout: (data, env) => placeFlow(data, env, layoutValueChain),
    emit: emitFlow,
    nameNodes: nameFlowShapeNodes,
    verify: { ...verifyFlow, rects: figureRects },
};
export function valueChain(parts, opts) {
    const data = build(parts, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const valueChainDefinition = definition;
