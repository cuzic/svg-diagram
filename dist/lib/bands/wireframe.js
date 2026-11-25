import { wireframeCalloutRules, wireframeCalloutVerification } from '../verify-wireframe-callouts.js';
import { band } from '../band-def.js';
import { wireframe as build } from '../dsl/wireframe.js';
import { renderPrims } from '../emit-wireframe.js';
import { placeWireframe } from '../layout-wireframes.js';
import { ownRect } from '../verify-rects.js';
import { collectTextRequests } from '../wireframe.js';
export { wf } from '../wireframe.js';
const definition = {
    type: 'wireframe',
    offGrid: true,
    internal: true,
    layout: placeWireframe,
    measure(data, { atoms }) {
        for (const [text, size, weight, font] of collectTextRequests(data))
            atoms(text, size, weight, font);
    },
    emit: (laid, { theme }) => renderPrims(laid, theme),
    rules: wireframeCalloutRules,
    verify: { rects: ownRect, ...wireframeCalloutVerification },
};
export function wireframe(root, opts) {
    const data = build(root, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const wireframeDefinition = definition;
