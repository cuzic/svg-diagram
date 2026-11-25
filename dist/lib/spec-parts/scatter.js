import { NUM, items, list, object, text, withoutType } from '../spec-kit.js';
import { CROSS } from './r6-common.js';
export function defineScatterPart(builder) {
    return {
        type: 'scatter',
        description: 'A scatter diagram (QC): one point per pair of values, to see whether two things move together. Points with a group get a colour and a shape per group (at most 4 groups). regression: true draws the least-squares line and writes the correlation coefficient r.',
        schema: object({
            type: { const: 'scatter' },
            x: text('The name of the horizontal axis, with its unit, such as 温度 (℃).', 30),
            y: text('The name of the vertical axis, with its unit.', 30),
            points: list(object({ x: NUM, y: NUM, label: text('Written beside the point (use for a few points only).', 20), group: text('The group (stratum) the point belongs to.', 20) }, ['x', 'y']), 200, 2),
            regression: { type: 'boolean', description: 'true: the least-squares line, r, the equation and n.' },
        }, ['type', 'x', 'y', 'points']),
        example: { type: 'scatter', x: '気温 (℃)', y: '販売数 (個)', regression: true, points: [{ x: 18, y: 120 }, { x: 21, y: 150 }, { x: 24, y: 175 }, { x: 27, y: 210 }, { x: 30, y: 260 }, { x: 33, y: 280 }] },
        check(part, at, issues) {
            const pts = items(part, 'points');
            const groups = [...new Set(pts.map(p => p['group']).filter(g => g !== undefined))];
            if (groups.length > 4)
                issues.push({ path: `${at}.points`, message: `has ${groups.length} groups; at most 4 can be told apart` });
            if (groups.length && pts.some(p => p['group'] === undefined))
                pts.forEach((p, i) => { if (p['group'] === undefined)
                    issues.push({ path: `${at}.points[${i}].group`, message: 'is missing: when some points have a group, every point needs one' }); });
            if (part['regression'] === true) {
                if (pts.length < 3)
                    issues.push({ path: `${at}.regression`, message: 'needs at least 3 points' });
                else if (pts.every(p => p['x'] === pts[0]?.['x']))
                    issues.push({ path: `${at}.regression`, message: 'every x is the same: there is no line to fit' });
            }
        },
        build(part) {
            const { points, ...opts } = withoutType(part);
            return builder(points, { ...opts, crossMark: CROSS });
        },
        en: { statSeparator: ', ' },
    };
}
