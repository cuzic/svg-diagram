import { frameLayoutFindings } from '../layout-metrics.js';
import { nameQuadrantNodes } from '../emit-node-ids.js';
import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { withHandle } from '../dsl/shared.js';
import { quadrantSpotlight, renderQuadrant } from '../emit-quadrant.js';
import { layoutQuadrant, quadrantBand, quadrantTexts } from '../quadrant.js';
import { scopeOf } from '../scope-name.js';
import { anchorRects } from '../verify-rects.js';
import { quadrantFindings, quadrantLayoutFindings, quadrantProblems } from '../verify-quadrant.js';
const definition = {
    type: 'quadrant',
    selfDimming: true,
    spotlight: quadrantSpotlight,
    offGrid: true,
    textSizes: texts,
    ids: data => data.items.flatMap(item => item.id ? [item.id] : []),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of quadrantTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, wrap }) {
        const scope = scopeOf(data);
        const placed = layoutQuadrant(data, x, y, w, widthOf, roles, wrap);
        const laid = scope ? { ...placed, scope } : placed;
        return { laid, h: laid.h, anchors: laid.anchors };
    },
    emit: (laid, { theme, tones }) => renderQuadrant(laid, theme, tones),
    nameNodes: nameQuadrantNodes,
    verify: {
        diagramFindings: frameLayoutFindings,
        findings: quadrantFindings,
        layoutFindings: quadrantLayoutFindings,
        rects: laid => anchorRects(laid),
        check: laid => quadrantProblems(laid).map(message => ({ rule: 'quadrant', severity: 'problem', message })),
    },
};
function build(opts) {
    const data = withHandle(quadrantBand(opts), opts.id);
    return band(definition, data);
}
function preset(name, opts) {
    return build({ ...opts, preset: name });
}
export const quadrant = /* @__PURE__ */ Object.assign(build, { preset });
/** @internal Definition used by the full renderer. */
export const quadrantDefinition = definition;
