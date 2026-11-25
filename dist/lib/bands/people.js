import { band } from '../band-def.js';
import { people as build } from '../dsl/people.js';
import { renderPeople } from '../emit-people.js';
import { snapGrid } from '../layout-util.js';
import { layoutPeople, peopleTexts } from '../people.js';
const definition = {
    type: 'people',
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of peopleTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, theme, roles }) {
        const laid = layoutPeople(data, x, snapGrid(y), w, widthOf, theme, roles);
        return { laid, h: laid.h };
    },
    emit: (laid, { theme, tones }) => renderPeople(laid, theme, tones),
};
export function people(total, count, opts) {
    const data = build(total, count, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const peopleDefinition = definition;
