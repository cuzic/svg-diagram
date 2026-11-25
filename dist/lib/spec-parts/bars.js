import { AMOUNT, CHART_TONE, items, list, object, text, withoutType } from '../spec-kit.js';
import { UNIT, BAR_TONE, DIR, uniqueLabels } from './r1-common.js';
export function defineBarsPart(builder) {
    return {
        type: 'bars',
        description: 'A bar chart: one bar per label, such as sales by month or votes by option. Values are 0 or more. dir v (columns) suits a few short labels or a time order; h (rows, the default) suits long labels or a ranking. Reference lines (a target, an average) need dir v.',
        schema: object({
            type: { const: 'bars' },
            data: list(object({ label: text('What the bar is.', 30), value: { ...AMOUNT, description: 'The value, 0 or more.' }, tone: { ...BAR_TONE, description: 'A colour to single the bar out (danger is red).' } }, ['label', 'value']), 30, 1),
            unit: UNIT,
            dir: DIR('the bars'),
            lines: { ...list(object({ at: { ...AMOUNT, description: 'The value the line is drawn at.' }, label: text('The name of the line, such as 目標.', 20), tone: CHART_TONE, dashed: { type: 'boolean', description: 'Default true.' } }, ['at']), 4), description: 'Horizontal reference lines across vertical bars (dir v only).' },
            grid: { type: 'boolean', description: 'true: lines across the plot at each tick.' },
            decimals: { type: 'integer', minimum: 0, maximum: 3, description: 'Decimals of the value labels (default: whole numbers as given, others to 3 significant digits).' },
        }, ['type', 'data']),
        example: { type: 'bars', dir: 'v', unit: '件', data: [{ label: '4月', value: 120 }, { label: '5月', value: 150 }, { label: '6月', value: 95, tone: 'danger' }], lines: [{ at: 110, label: '目標' }] },
        check(part, at, issues) {
            const data = items(part, 'data');
            uniqueLabels(data, `${at}.data`, 'bar', issues);
            const values = data.map(d => d['value']);
            if (values.length && values.every(v => v === 0))
                issues.push({ path: `${at}.data`, message: 'every value is 0: there is nothing to draw' });
            const lines = items(part, 'lines');
            if (lines.length && part['dir'] !== 'v')
                issues.push({ path: `${at}.lines`, message: "reference lines are drawn across vertical bars: add dir: 'v'" });
            const max = Math.max(0, ...values);
            lines.forEach((l, i) => { if (l['at'] > max)
                issues.push({ path: `${at}.lines[${i}].at`, message: `is ${String(l['at'])}, above the tallest bar (${max}): the axis ends there` }); });
        },
        build(part) {
            const { data, decimals, ...opts } = withoutType(part);
            return builder(data, { ...opts, ...(decimals === undefined ? {} : { valueFormat: decimals }) });
        },
    };
}
