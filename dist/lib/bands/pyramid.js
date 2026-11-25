import { band } from '../band-def.js';
import { pyramid as build } from '../dsl/pyramid.js';
import { renderPyramid } from '../emit-pyramid.js';
import { layoutPyramid } from '../layout-pyramid.js';
const definition = {
    type: 'pyramid',
    internal: true,
    layout: layoutPyramid,
    measure(data, { atoms, roles }) {
        for (const layer of data.layers)
            atoms(layer.text, roles.title, 700);
    },
    emit: (laid, env) => renderPyramid(laid, env.roles),
};
export function pyramid(layers, opts) {
    return band(definition, build(layers, opts));
}
/** @internal Definition used by the full renderer. */
export const pyramidDefinition = definition;
