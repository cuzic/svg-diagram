import { flowSpotlight } from '../emit-flow-shape.js';
import { nameFlowShapeNodes } from '../emit-node-ids.js';
import { chevronLoopBack } from '../loop-back-source.js';
import { figureRects } from '../verify-rects.js';
import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { chevron as build } from '../dsl/chevron.js';
import { emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow } from '../flow-definition.js';
import { chevronTexts, layoutChevron } from '../flow-chevron.js';
const definition = {
    type: 'chevron',
    selfDimming: true,
    spotlight: flowSpotlight,
    loopBackSource: chevronLoopBack,
    title: data => [2, data.steps[0]?.label],
    textSizes: texts,
    ids: data => flowItemIds(data.steps),
    measure: (data, env) => measureFlow(data, env, chevronTexts),
    layout: (data, env) => placeFlow(data, env, layoutChevron),
    emit: emitFlow,
    nameNodes: nameFlowShapeNodes,
    verify: { ...verifyFlow, rects: figureRects },
};
export function chevron(steps, opts) {
    const data = build(steps, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const chevronDefinition = definition;
