import { band } from '../band-def.js';
import { curve as build } from '../dsl/curve.js';
import { renderCurve } from '../emit-curve.js';
import { layoutCurve } from '../layout-curve.js';
const definition = {
    type: 'curve',
    internal: true,
    layout: layoutCurve,
    measure(data, { atoms, roles }) {
        for (const label of [data.yTopLabel, data.yBottomLabel, data.xLabel])
            if (label)
                atoms(label, roles.note, 400);
    },
    emit: (laid, env) => renderCurve(laid, env.theme, env.tones),
};
export function curve(points, opts) {
    return band(definition, build(points, opts));
}
/** @internal Definition used by the full renderer. */
export const curveDefinition = definition;
