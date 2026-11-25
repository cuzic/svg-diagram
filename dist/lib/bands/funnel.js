import { flowSpotlight } from '../emit-flow-shape.js';
import { nameFlowShapeNodes } from '../emit-node-ids.js';
import { figureRects } from '../verify-rects.js';
import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { funnel as build } from '../dsl/funnel.js';
import { emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow } from '../flow-definition.js';
import { funnelTexts, layoutFunnel } from '../flow-funnel.js';
import { funnelFindings } from '../verify-funnel.js';
const definition = {
    type: 'funnel',
    selfDimming: true,
    spotlight: flowSpotlight,
    title: data => [2, data.stages[0]?.label],
    textSizes: texts,
    ids: data => flowItemIds(data.stages),
    measure: (data, env) => measureFlow(data, env, funnelTexts),
    layout: (data, env) => placeFlow(data, env, layoutFunnel),
    emit: emitFlow,
    nameNodes: nameFlowShapeNodes,
    verify: { ...verifyFlow, rects: figureRects, findings: funnelFindings },
};
export function funnel(stages, opts) {
    const data = build(stages, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const funnelDefinition = definition;
