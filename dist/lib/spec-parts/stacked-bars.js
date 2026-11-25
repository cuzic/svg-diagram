import { AMOUNT, items, list, object, text, withoutType } from '../spec-kit.js';
import { UNIT, uniqueLabels, nums } from './r1-common.js';
export function defineStackedBarsPart(builder) {
    return {
        type: 'stackedBars',
        description: 'A stacked bar chart: each column is split into parts (the same series in every column), such as sales by product per quarter. The total is written on top. percent: true makes every column 100% and writes shares, for comparing make-up rather than size. Up to 6 series.',
        schema: object({
            type: { const: 'stackedBars' },
            series: list(text('The name of a part, shown in the legend.', 20), 6, 1),
            columns: list(object({ label: text('What the column is, such as 2024年.', 20), values: list({ ...AMOUNT, description: 'One per series, in the order of series; 0 for none.' }, 6, 1) }, ['label', 'values']), 12, 1),
            unit: UNIT,
            percent: { type: 'boolean', description: 'true: every column is 100% and the parts are shares.' },
        }, ['type', 'series', 'columns']),
        example: { type: 'stackedBars', unit: '万円', series: ['製品 A', '製品 B', '保守'], columns: [{ label: '第1四半期', values: [120, 80, 40] }, { label: '第2四半期', values: [150, 90, 45] }, { label: '第3四半期', values: [170, 70, 55] }] },
        check(part, at, issues) {
            const series = part['series'], n = series.length;
            series.forEach((s, i) => { if (series.indexOf(s) !== i)
                issues.push({ path: `${at}.series[${i}]`, message: `"${String(s)}" is used twice (each series needs its own name)` }); });
            const cols = items(part, 'columns');
            uniqueLabels(cols, `${at}.columns`, 'column', issues);
            cols.forEach((c, i) => {
                const v = nums(c['values']);
                if (v.length !== n)
                    issues.push({ path: `${at}.columns[${i}].values`, message: `has ${v.length} values; there are ${n} series` });
                else if (part['percent'] === true && v.every(x => x === 0))
                    issues.push({ path: `${at}.columns[${i}].values`, message: 'adds up to 0, so it has no shares' });
            });
            if (cols.length && cols.every(c => nums(c['values']).every(x => x === 0)))
                issues.push({ path: `${at}.columns`, message: 'every column is 0: there is nothing to draw' });
        },
        build(part) {
            const { series, columns, ...opts } = withoutType(part);
            const names = series;
            return builder(columns.map(c => ({ label: c['label'], parts: names.map((s, i) => ({ label: s, value: c['values'][i] })) })), opts);
        },
        en: { totalLabel: 'Total' },
    };
}
