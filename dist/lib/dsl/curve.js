import { assertNoReveal } from './shared.js';
export function curve(points, opts = {}) {
    assertNoReveal(opts, 'curve()');
    if (!Array.isArray(points) || points.length < 2)
        throw new Error('curve(points) needs at least 2 points');
    for (const p of points) {
        if (typeof p.y !== 'number')
            throw new Error('curve(): every point needs a numeric y (0 = axis bottom, 1 = axis top)');
    }
    return {
        type: 'curve', points,
        height: opts.height ?? 220,
        width: opts.width,
        yTopLabel: opts.yTopLabel, yBottomLabel: opts.yBottomLabel, xLabel: opts.xLabel,
    };
}
