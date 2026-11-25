import { describeSequence } from '../diagram-description.js';
import { band } from '../band-def.js';
import { sequence as build } from '../dsl/sequence.js';
import { renderSequence } from '../emit-sequence.js';
import { snapGrid } from '../layout-util.js';
import { layoutSequence, sequenceTexts } from '../layout-sequence.js';
const definition = {
    type: 'sequence',
    describe: data => ['structure', describeSequence(data)],
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of sequenceTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, wrap }) {
        const laid = layoutSequence(data, x, snapGrid(y), w, widthOf, roles, wrap);
        return { laid, h: laid.h };
    },
    emit: (laid, { theme, tones, roles }) => renderSequence(laid, theme, tones, roles),
    svgDefs: laid => ({ arrow: laid.steps.some(step => step.kind === 'self' || step.kind === 'msg' && step.arrow !== 'none') }),
};
export function sequence(actors, steps, opts) {
    const data = build(actors, steps, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const sequenceDefinition = definition;
