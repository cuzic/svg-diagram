import { layoutFitRules, layoutFitVerification } from '../verify-layout-fit.js';
import { edgeBendFindings } from '../verify-edge-bends.js';
import { textsAndLabels } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { classesTexts, layoutClassesBand } from '../classes.js';
import { classDiagram as build } from '../dsl/classes.js';
import { renderClasses } from '../emit-classes.js';
import { snapGrid } from '../layout-util.js';
import { scopeOf } from '../scope-name.js';
import { classesProblems } from '../verify-classes.js';
import { anchorRects } from '../verify-rects.js';
const definition = {
    type: 'classes',
    selfDimming: true,
    textSizes: textsAndLabels,
    ids: data => data.classes.map(item => item.id),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of classesTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, wrap, keepWords = false, space }) {
        const scope = scopeOf(data);
        const placed = layoutClassesBand(data, x, snapGrid(y), w, widthOf, roles, { wrap, keepWords, space });
        const laid = scope ? { ...placed, scope } : placed;
        return { laid, h: laid.h, anchors: laid.anchors };
    },
    emit: (laid, { theme, tones }) => renderClasses(laid, theme, tones),
    locations: { drawsFrame: (_laid, item) => item !== undefined },
    rules: layoutFitRules,
    verify: {
        ...layoutFitVerification,
        diagramFindings: edgeBendFindings,
        rects: laid => anchorRects(laid),
        check: laid => classesProblems(laid).map(message => ({ rule: 'classes', severity: 'problem', message })),
    },
};
export function classDiagram(classes, relations, opts) {
    const data = build(classes, relations, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const classesDefinition = definition;
