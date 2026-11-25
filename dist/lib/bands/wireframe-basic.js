import { wireframeCalloutRules, wireframeCalloutVerification } from '../verify-wireframe-callouts.js';
import { band } from '../band-def.js';
import { wireframe as build } from '../dsl/wireframe.js';
import { renderPrims } from '../emit-wireframe.js';
import { appendScreen } from '../wireframe-placement.js';
import { ownRect } from '../verify-rects.js';
import { basicWireframeRuntime, collectTextRequestsWith, layoutWireframeWith } from '../wireframe-layout-core.js';
export function wireframeFor(runtime) {
    const definition = {
        type: 'wireframe',
        offGrid: true,
        internal: true,
        layout(data, ctx, x, width) {
            appendScreen(layoutWireframeWith(runtime, data, x, ctx.y, width, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
        },
        measure(data, { atoms }) {
            for (const [text, size, weight, font] of collectTextRequestsWith(data, runtime))
                atoms(text, size, weight, font);
        },
        emit: (laid, { theme }) => renderPrims(laid, theme),
        rules: wireframeCalloutRules,
        verify: { rects: ownRect, ...wireframeCalloutVerification },
    };
    return function wireframe(root, opts) {
        const data = build(root, opts);
        return band(definition, data);
    };
}
export const wireframe = /* @__PURE__ */ wireframeFor(basicWireframeRuntime);
