import { NUM, items, list, object, text, withoutType } from '../spec-kit.js';
import { isNum } from './r2-common.js';
export function defineStrategyCanvasPart(builder) {
    return {
        type: 'strategyCanvas',
        description: "A strategy canvas (Blue Ocean): the factors of competition along the bottom and the level each company offers on each, one line per company. Levels run from min to max (default 0 to 5).",
        schema: object({
            type: { const: 'strategyCanvas' },
            factors: list(text('A factor of competition.', 14), 10, 2),
            series: list(object({ label: text('The company or the offer.', 20), values: list(NUM, 10, 2) }, ['label', 'values']), 5, 1),
            min: { type: 'integer', minimum: 0, maximum: 9, description: 'The lowest level (default 0).' },
            max: { type: 'integer', minimum: 1, maximum: 10, description: 'The highest level (default 5).' },
            lowLabel: text('The word at the lowest level (default 低い).', 10),
            highLabel: text('The word at the highest level (default 高い).', 10),
            yLabel: text('The name of the vertical axis (default 提供価値の水準).', 20),
        }, ['type', 'factors', 'series']),
        example: { type: 'strategyCanvas', factors: ['価格', '品揃え', '接客', '待ち時間', '居心地'], series: [{ label: '従来の理容店', values: [4, 3, 4, 4, 3] }, { label: 'QBハウス型', values: [1, 1, 1, 1, 1] }] },
        check(part, at, issues) {
            const n = items(part, 'factors').length;
            const lo = isNum(part['min']) ? part['min'] : 0, hi = isNum(part['max']) ? part['max'] : 5;
            if (!(lo < hi))
                issues.push({ path: `${at}.max`, message: `must be more than min (${lo})` });
            items(part, 'series').forEach((s, i) => {
                const vs = s['values'];
                if (vs.length !== n)
                    issues.push({ path: `${at}.series[${i}].values`, message: `has ${vs.length} levels; there are ${n} factors` });
                vs.forEach((v, j) => { if (v < lo || v > hi)
                    issues.push({ path: `${at}.series[${i}].values[${j}]`, message: `is ${v}, outside the levels ${lo} to ${hi}` }); });
            });
        },
        build(part) {
            const { factors, series, min, max, lowLabel, highLabel, yLabel } = withoutType(part);
            const levels = { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }), ...(lowLabel === undefined ? {} : { low: lowLabel }), ...(highLabel === undefined ? {} : { high: highLabel }) };
            return builder(factors, series, { levels, ...(yLabel === undefined ? {} : { y: { label: yLabel } }) });
        },
        en: { lowLabel: 'Low', highLabel: 'High', yLabel: 'Level offered' },
    };
}
