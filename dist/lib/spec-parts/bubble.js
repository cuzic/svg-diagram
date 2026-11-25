import { AMOUNT, CHART_TONE, NUM, items, list, object, text, withoutType } from '../spec-kit.js';
import { unit, isNum, positive, minBelowMax } from './r2-common.js';
const bubbleAxis = (which) => object({
    title: text('The name of the axis.', 30),
    unit: unit('Written after the numbers of the axis.'),
    min: NUM, max: NUM,
    line: { ...NUM, description: 'A dashed reference line at this value (a threshold).' },
    lineLabel: text('The name of the reference line.', 20),
}, [], `The ${which} axis.`);
export function defineBubblePart(builder) {
    return {
        type: 'bubble',
        description: 'A bubble chart: items placed by two measures (x, y) with a circle whose area is a third, such as products by growth, share and sales. Axes can have a dashed threshold line.',
        schema: object({
            type: { const: 'bubble' },
            points: list(object({
                label: text('The name of the item.', 20),
                x: NUM, y: NUM,
                size: { ...AMOUNT, description: 'The measure the area stands for: more than 0.' },
                tone: CHART_TONE,
            }, ['label', 'x', 'y', 'size']), 20, 1),
            x: bubbleAxis('horizontal'),
            y: bubbleAxis('vertical'),
            sizeTitle: text("What the area stands for ('売上').", 20),
            sizeUnit: unit('The unit of the area measure.'),
        }, ['type', 'points']),
        example: { type: 'bubble', x: { title: '市場成長率', unit: '%' }, y: { title: '利益率', unit: '%' }, sizeTitle: '売上', sizeUnit: '億円', points: [{ label: '製品A', x: 12, y: 18, size: 40, tone: 'accent' }, { label: '製品B', x: 4, y: 25, size: 90 }, { label: '製品C', x: 8, y: 6, size: 20 }] },
        check(part, at, issues) {
            items(part, 'points').forEach((p, i) => positive(p['size'], `${at}.points[${i}].size`, 'a size', issues));
            const seen = new Set();
            items(part, 'points').forEach((p, i) => { const l = p['label']; if (seen.has(l))
                issues.push({ path: `${at}.points[${i}].label`, message: `"${l}" is used twice: name every item differently` }); seen.add(l); });
            for (const k of ['x', 'y']) {
                const a = part[k];
                minBelowMax(a, `${at}.${k}`, issues);
                if (a && a['lineLabel'] !== undefined && a['line'] === undefined)
                    issues.push({ path: `${at}.${k}.lineLabel`, message: 'names a line: give line too' });
                if (a && isNum(a['line'])) {
                    const vs = items(part, 'points').map(p => p[k]);
                    const lo = isNum(a['min']) ? a['min'] : Math.min(...vs), hi = isNum(a['max']) ? a['max'] : Math.max(...vs);
                    if (isNum(a['min']) && a['line'] < lo || isNum(a['max']) && a['line'] > hi)
                        issues.push({ path: `${at}.${k}.line`, message: `is outside the axis (${lo} to ${hi})` });
                }
            }
        },
        build(part) {
            const { points, ...opts } = withoutType(part);
            return builder(points, opts);
        },
        en: { areaLabel: 'Bubble area', circleLabel: 'one circle', brackets: [' (', ')'] },
    };
}
