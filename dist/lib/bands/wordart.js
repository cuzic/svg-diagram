import { band } from '../band-def.js';
import { wordart as build } from '../dsl/wordart.js';
import { renderWordArt } from '../emit-wordart.js';
import { paintOf } from '../tokens.js';
import { layoutWordArt, wordArtTexts } from '../wordart-layout.js';
import { legibilityProblem } from '../wordart-look.js';
const definition = {
    type: 'wordart',
    selfDimming: true,
    offGrid: true,
    title: data => [2, data.text],
    textSizes: band => [band.size],
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of wordArtTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, wrap }) {
        const laid = layoutWordArt(data, x, y, w, widthOf, roles, wrap);
        return { laid, h: laid.h };
    },
    emit: (laid, { theme }) => renderWordArt(laid, theme, !!laid.dim),
    verify: {
        check(laid, { theme, tones }) {
            const why = legibilityProblem(laid.look, theme, paintOf(tones, undefined));
            return why ? [{ rule: 'wordart', severity: 'problem', message: `wordart "${laid.text.slice(0, 20)}": ${why}` }] : [];
        },
    },
};
export function wordart(text, opts) {
    const data = build(text, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const wordartDefinition = definition;
