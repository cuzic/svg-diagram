import { sizesOf } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { cloudTexts, layoutCloudBand } from '../cloud.js';
import { cloud as build } from '../dsl/cloud.js';
import { renderCloud } from '../emit-cloud.js';
import { snapGrid } from '../layout-util.js';
import { scopeOf } from '../scope-name.js';
import { cloudProblems, cloudRects } from '../verify-cloud.js';
const definition = {
    type: 'cloud',
    selfDimming: true,
    textSizes: band => [...sizesOf(band.texts), ...sizesOf(band.chips)],
    ids: data => ['a', 'b', 'c', 'd', 'd2'].flatMap(key => {
        const item = data[key];
        return typeof item !== 'string' && item.id ? [item.id] : [];
    }),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of cloudTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, wrap, keepWords = false, space }) {
        const scope = scopeOf(data);
        const placed = layoutCloudBand(data, x, snapGrid(y), w, widthOf, roles, { wrap, keepWords, space });
        const laid = scope ? { ...placed, scope } : placed;
        return { laid, h: laid.h, anchors: laid.anchors };
    },
    emit: (laid, { theme, tones }) => renderCloud(laid, theme, tones),
    locations: { drawsFrame: (_laid, item) => item !== undefined },
    verify: {
        rects: cloudRects,
        check: laid => cloudProblems(laid).map(message => ({ rule: 'cloud', severity: 'problem', message })),
    },
};
export function cloud(boxes, opts) {
    const data = build(boxes, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const cloudDefinition = definition;
