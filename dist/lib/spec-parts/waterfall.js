import { CHART_TONE, NUM, items, list, object, oneOf, text, withoutType } from '../spec-kit.js';
import { UNIT, DIR } from './r1-common.js';
export function defineWaterfallPart(builder) {
    return {
        type: 'waterfall',
        description: "A waterfall chart: how a starting amount becomes an ending one through increases and decreases, such as last year's profit to this year's. The first step is the start (its level); every other step is a change (+ rises, - falls), unless its kind is subtotal or total, which shows the running level (its value may be left out).",
        schema: object({
            type: { const: 'waterfall' },
            steps: list(object({
                label: text('What the step is.', 30),
                value: { ...NUM, description: 'The start level, or the change (+/-). A subtotal or total may leave it out.' },
                kind: { ...oneOf('start', 'delta', 'subtotal', 'total'), description: 'Default: start for the first step, delta for the rest.' },
                tone: { ...CHART_TONE, description: 'Overrides the colour (default: rises accent, falls red, totals dark).' },
            }, ['label']), 16, 2),
            unit: UNIT,
            dir: DIR('the steps'),
            connectors: { type: 'boolean', description: 'false: no lines between the bars.' },
        }, ['type', 'steps']),
        example: { type: 'waterfall', unit: '百万円', steps: [{ label: '前年の利益', value: 500 }, { label: '売上増', value: 180 }, { label: '原価増', value: -90 }, { label: '販管費減', value: 30 }, { label: '今年の利益', kind: 'total' }] },
        check(part, at, issues) {
            items(part, 'steps').forEach((s, i) => {
                const kind = s['kind'] ?? (i === 0 ? 'start' : 'delta');
                if (kind === 'start' && i !== 0)
                    issues.push({ path: `${at}.steps[${i}].kind`, message: "only the first step can be the start: write delta for a change" });
                if ((kind === 'subtotal' || kind === 'total') && i === 0)
                    issues.push({ path: `${at}.steps[${i}].kind`, message: `a ${String(kind)} adds up the steps before it, so it cannot be the first step` });
                if ((kind === 'start' || kind === 'delta') && s['value'] === undefined)
                    issues.push({ path: `${at}.steps[${i}].value`, message: kind === 'start' ? 'is required: the level the chart starts from' : 'is required: the change (+ or -)' });
            });
        },
        build(part) {
            const { steps, ...opts } = withoutType(part);
            return builder(steps, opts);
        },
    };
}
