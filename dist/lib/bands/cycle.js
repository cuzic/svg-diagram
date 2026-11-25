import { flowSpotlight } from '../emit-flow-shape.js';
import { nameFlowShapeNodes } from '../emit-node-ids.js';
import { figureRects } from '../verify-rects.js';
import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { cycle as build } from '../dsl/cycle.js';
import { emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow } from '../flow-definition.js';
import { cycleTexts, layoutCycleShape } from '../flow-cycle.js';
const definition = {
    type: 'cycle',
    selfDimming: true,
    spotlight: flowSpotlight,
    title: data => [2, data.steps[0]?.label],
    textSizes: texts,
    ids: data => flowItemIds(data.steps),
    measure: (data, env) => measureFlow(data, env, cycleTexts),
    layout: (data, env) => placeFlow(data, env, layoutCycleShape),
    emit: emitFlow,
    nameNodes: nameFlowShapeNodes,
    svgDefs: () => ({ arrow: true }),
    verify: { ...verifyFlow, rects: figureRects },
};
export function cycle(steps, opts) {
    const data = build(steps, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const cycleDefinition = definition;
