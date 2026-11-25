import { layoutFitRules, layoutFitVerification } from '../verify-layout-fit.js';
import { texts } from '../band-text-sizes.js';
import { analysisFindings } from '../finding-rules.js';
import { bowtieFindings } from '../rca-rules.js';
import { band } from '../band-def.js';
import { bowtieMeasure, layoutBowtie } from '../bowtie.js';
import { bowtie as build } from '../dsl/bowtie.js';
import { renderBowtie } from '../emit-bowtie.js';
import { snapGrid } from '../layout-util.js';
import { bowtieRects } from '../verify-bowtie-rects.js';
const definition = {
    type: 'bowtie',
    selfDimming: true,
    textSizes: texts,
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of bowtieMeasure(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, wrap, keepWords = false, space }) {
        const laid = layoutBowtie(data, x, snapGrid(y), w, widthOf, roles, { wrap, keepWords, space });
        return { laid, h: laid.h };
    },
    emit: (laid, { theme, tones }) => renderBowtie(laid, theme, tones),
    locations: { drawsFrame: (_laid, item) => item !== undefined },
    rules: layoutFitRules,
    verify: { ...layoutFitVerification, rects: bowtieRects, findings: (data, { rcaCheck }) => analysisFindings(data, bowtieFindings(data), rcaCheck === 'strict' ? 'warn' : 'info') },
};
export function bowtie(input, opts) {
    const data = build(input, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const bowtieDefinition = definition;
