import { band } from '../band-def.js';
import { dots as build } from '../dsl/dots.js';
import { renderDots } from '../emit-dots.js';
import { snapGrid } from '../layout-util.js';
import { layoutDots, dotsTexts } from '../layout-dots.js';
const definition = {
    type: 'dots',
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of dotsTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, theme, roles }) {
        const laid = layoutDots(data, x, snapGrid(y), w, widthOf, theme, roles);
        return { laid, h: laid.h };
    },
    emit: (laid, { theme, tones }) => renderDots(laid, theme, tones),
};
export function dots(values, opts) {
    const data = build(values, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const dotsDefinition = definition;
