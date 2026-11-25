import { layoutFitRules, layoutFitVerification } from '../verify-layout-fit.js';
import { texts } from '../band-text-sizes.js';
import { analysisFindings } from '../finding-rules.js';
import { ftaFindings } from '../fta-rules.js';
import { band } from '../band-def.js';
import { faultTree as build } from '../dsl/fta.js';
import { renderFta } from '../emit-fta.js';
import { ftaIds, ftaTexts, layoutFta } from '../fta.js';
import { snapGrid } from '../layout-util.js';
import { scopeOf } from '../scope-name.js';
import { ftaRects } from '../verify-fta-rects.js';
const definition = {
    type: 'fta',
    selfDimming: true,
    textSizes: texts,
    ids: data => ftaIds(data.root),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of ftaTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, wrap, keepWords = false, space }) {
        const placed = layoutFta(data, x, snapGrid(y), w, widthOf, roles, { wrap, keepWords, space });
        const scope = scopeOf(data);
        const laid = scope ? { ...placed, scope } : placed;
        return { laid, h: laid.h, anchors: laid.anchors };
    },
    emit: (laid, { theme, tones }) => renderFta(laid, theme, tones),
    locations: { drawsFrame: (_laid, item) => item !== undefined },
    rules: layoutFitRules,
    verify: { ...layoutFitVerification, rects: ftaRects, findings: (data, { rcaCheck }) => analysisFindings(data, ftaFindings(data), rcaCheck === 'strict' ? 'warn' : 'info') },
};
export function faultTree(top, opts) {
    const data = build(top, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const ftaDefinition = definition;
