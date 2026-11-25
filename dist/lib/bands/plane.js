import { band } from '../band-def.js';
import { plane as build } from '../dsl/plane.js';
import { renderPlane } from '../emit-plane.js';
import { layoutPlane, planeTexts } from '../plane.js';
import { revealPlane } from '../reveal-plane.js';
import { fillTextSize } from '../slide-fill-text.js';
import { planeProblems } from '../verify-plane.js';
export const planeDefinition = {
    type: 'plane',
    offGrid: true,
    textSizes: band => [band.labelSize],
    fillTextSize: (data, roles) => fillTextSize(roles, data.labelRole),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of planeTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, canvas, geometryScale }) {
        const sized = canvas && data.labelRole === undefined ? { ...data, labelRole: 'note' } : data;
        const laid = layoutPlane(sized, x, y, w, widthOf, roles, geometryScale);
        return { laid, h: laid.h };
    },
    revealElements: revealPlane,
    emit: (laid, { theme, tones, stage }) => renderPlane(laid, theme, tones, stage),
    verify: {
        check: laid => planeProblems(laid).map(message => ({ rule: 'plane', severity: 'problem', message })),
    },
};
export function plane(opts) {
    const data = build(opts);
    return band(planeDefinition, data);
}
