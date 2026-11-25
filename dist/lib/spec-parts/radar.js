import { NUM, items, list, object, text, withoutType } from '../spec-kit.js';
import { UNIT, uniqueLabels, nums } from './r1-common.js';
export function defineRadarPart(builder) {
    return {
        type: 'radar',
        description: 'A radar chart: several scores on axes around a centre, one polygon per series, such as skills of a person or features of products. 3 to 12 axes, 1 to 4 series, each with one value per axis.',
        schema: object({
            type: { const: 'radar' },
            axes: list(text('What is scored, such as 価格.', 16), 12, 3),
            series: list(object({ label: text('Who or what is scored.', 20), values: list({ ...NUM, description: 'One per axis, in the order of axes.' }, 12, 3) }, ['label', 'values']), 4, 1),
            min: { ...NUM, description: 'The value at the centre (default 0).' },
            max: { ...NUM, description: 'The value at the outer ring, such as 5 for a 5-point score (default: a round number above the largest value).' },
            values: { type: 'boolean', description: 'true: write the value at every point.' },
            unit: UNIT,
        }, ['type', 'axes', 'series']),
        example: { type: 'radar', max: 5, axes: ['価格', '品質', 'サポート', '使いやすさ', '機能'], series: [{ label: '自社', values: [4, 3, 5, 4, 3] }, { label: '競合', values: [3, 4, 3, 3, 5] }] },
        check(part, at, issues) {
            const n = items(part, 'axes').length, series = items(part, 'series');
            uniqueLabels(series, `${at}.series`, 'series', issues);
            const lo = part['min'] ?? 0, hi = part['max'];
            if (hi !== undefined && !(hi > lo))
                issues.push({ path: `${at}.max`, message: `must be above min (${lo})` });
            series.forEach((s, i) => {
                const v = nums(s['values']);
                if (v.length !== n)
                    issues.push({ path: `${at}.series[${i}].values`, message: `has ${v.length} values; there are ${n} axes` });
                v.forEach((x, j) => {
                    if (x < lo)
                        issues.push({ path: `${at}.series[${i}].values[${j}]`, message: `is ${x}, below min (${lo}): set min lower` });
                    if (hi !== undefined && x > hi)
                        issues.push({ path: `${at}.series[${i}].values[${j}]`, message: `is ${x}, above max (${hi})` });
                });
            });
        },
        build(part) {
            const { axes, series, ...opts } = withoutType(part);
            return builder(axes, series, opts);
        },
    };
}
