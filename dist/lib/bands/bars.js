import { hiddenBarsDescription } from '../diagram-description.js';
import { definedDiagramTitle } from '../diagram-title.js';
import { findingAcceptanceHint } from '../finding-rules.js';
import { selectedAxisFindings } from '../axis-selected.js';
import { texts } from '../band-text-sizes.js';
import { band, walkDefinedBands } from '../band-def.js';
import { barsTexts, layoutBars, barsValueAxis } from '../bars.js';
import { bars as build, histogram as buildHistogram, pareto as buildPareto, rangeBars as buildRangeBars } from '../dsl/bars.js';
import { barsSpotlight, renderBars } from '../emit-bars.js';
import { snapGrid } from '../layout-util.js';
import { revealBarElements } from '../reveal-bars.js';
import { scopeOf } from '../scope-name.js';
import { fillTextSize } from '../slide-fill-text.js';
import { luminance, paintOf } from '../tokens.js';
import { barsContrastProblems, barsProblems, barsRects, hiddenBarsTitleFindings, thinBarFindings } from '../verify-bars.js';
const hiddenValuesFindings = (diagram, stage) => hiddenBarsTitleFindings(diagram, () => definedDiagramTitle(diagram, stage), walkDefinedBands, stage);
const definition = {
    type: 'bars',
    selfDimming: true,
    spotlight: barsSpotlight,
    describe(data, stage) {
        const description = hiddenBarsDescription(data, stage);
        return description ? ['values', description] : undefined;
    },
    valueAxis: barsValueAxis,
    textSizes: texts,
    fillTextSize: (data, roles) => fillTextSize(roles, data.labelRole),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of barsTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, canvas, geometryScale }) {
        const scope = scopeOf(data);
        const sized = canvas && data.labelRole === undefined ? { ...data, labelRole: 'note' } : data;
        const placed = layoutBars(sized, x, snapGrid(y), w, widthOf, roles, geometryScale);
        const laid = scope ? { ...placed, scope } : placed;
        return { laid, h: laid.h, anchors: laid.anchors };
    },
    revealElements: revealBarElements,
    emit: (laid, { theme, stage, dimFill }) => renderBars(laid, theme, stage, dimFill),
    verify: {
        rects: barsRects,
        diagramFindings: [thinBarFindings, selectedAxisFindings, hiddenValuesFindings],
        acceptHint: rule => rule === 'bars-values-hidden' ? findingAcceptanceHint(rule) : undefined,
        check: laid => barsProblems(laid).map(message => ({ rule: 'bars', severity: 'problem', message })),
        contrast(laid, { theme, tones, appearance, dimFill }) {
            const paint = paintOf(tones, appearance);
            return barsContrastProblems(laid, theme, hex => luminance(paint(hex)), dimFill);
        },
    },
};
function define(data) {
    return band(definition, data);
}
export function bars(data, opts) {
    return define(build(data, opts));
}
export function rangeBars(data, opts) {
    return define(buildRangeBars(data, opts));
}
export function pareto(items, opts) {
    return define(buildPareto(items, opts));
}
export function histogram(values, opts) {
    return define(buildHistogram(values, opts));
}
/** @internal Definition used by the full renderer. */
export const barsDefinition = definition;
