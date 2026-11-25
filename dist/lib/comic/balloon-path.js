// Comic balloons share the rounded outline generator and keep their own styling dimensions.
import { balloonOutline } from '../shapes/balloon.js';
/** The corner radius of a body: `say` and `think` (the same shape, dashed) are rounded to the ends (at most 24), `shout` is nearly square, `narration` is square. */
export const balloonRadius = (kind, h) => kind === 'say' || kind === 'think' ? Math.min(h / 2, 24) : kind === 'shout' ? 6 : 0;
export function balloonPath(body, kind, tail) {
    const radius = Math.min(balloonRadius(kind, body.h), body.w / 2);
    const { d, base } = balloonOutline('round', body, kind === 'narration' ? undefined : tail?.tip, {
        radius, halfWidth: tail?.halfWidth ?? 8,
    });
    if (!base)
        return { d };
    return { d, base: [[...base[0]], [...base[1]]] };
}
