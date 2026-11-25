import { band } from '../band-def.js';
import { raw as buildRaw } from '../dsl/raw.js';
import { renderRaw } from '../emit-raw.js';
import { layoutRaw } from '../layout-raw.js';
const definition = {
    type: 'raw',
    internal: true,
    layout: layoutRaw,
    emit: (laid, env) => renderRaw(laid, env.theme),
};
export function raw(opts) {
    return band(definition, buildRaw(opts));
}
/** @internal Definition used by the full renderer. */
export const rawDefinition = definition;
