import { flowSpotlight } from '../emit-flow-shape.js';
import { nameFlowShapeNodes } from '../emit-node-ids.js';
import { concentricFindings } from '../verify-concentric.js';
import { overlappingFigureRects } from '../verify-rects.js';
import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { concentric as build } from '../dsl/concentric.js';
import { emitFlow, flowItemIds, measureFlow, placeFlow, verifyFlow } from '../flow-definition.js';
import { concentricTexts, layoutConcentricShape } from '../flow-concentric.js';
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
    nameNodes: nameFlowShapeNodes,
    svgDefs: laid => ({ arrow: laid.primitives.some(p => p.k === 'path' && !!p.arrow) }),
    verify: { ...verifyFlow, rects: overlappingFigureRects, layoutFindings: concentricFindings },
};
export function concentric(rings, opts) {
    const data = typeof rings === 'number'
        ? build(rings, opts)
        : build(rings, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const concentricDefinition = definition;
