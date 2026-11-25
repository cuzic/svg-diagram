import { EMPHASIS_TONE, items, list, object, oneOf, text, withoutType } from '../spec-kit.js';
export function defineFunnelPart(builder) {
    return {
        type: 'funnel',
        description: 'A funnel: stages that narrow, such as visits to orders. With values, the widths follow them and the rate between stages can be written.',
        schema: object({
            type: { const: 'funnel' },
            stages: list(object({ label: text('The stage.', 30), value: { type: 'number', minimum: 0, maximum: 1e12 }, tone: EMPHASIS_TONE }, ['label']), 7, 2),
            scale: { ...oneOf('value', 'even'), description: 'value: widths follow the values. even: equal steps.' },
            showRate: { type: 'boolean', description: 'true: write the rate from each stage to the next.' },
        }, ['type', 'stages']),
        example: { type: 'funnel', scale: 'value', showRate: true, stages: [{ label: '訪問', value: 1200 }, { label: '問い合わせ', value: 420 }, { label: '商談', value: 160 }, { label: '成約', value: 52 }] },
        check(part, at, issues) {
            const valued = items(part, 'stages').map(s => s['value'] !== undefined);
            if ((part['scale'] === 'value' || part['showRate'] === true) && valued.includes(false))
                valued.forEach((v, i) => { if (!v)
                    issues.push({ path: `${at}.stages[${i}].value`, message: 'is required when the widths or the rates follow the values' }); });
        },
        build(part) {
            const { stages, ...opts } = withoutType(part);
            return builder(stages, opts);
        },
    };
}
