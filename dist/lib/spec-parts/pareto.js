import { AMOUNT, items, list, object, text, withoutType } from '../spec-kit.js';
import { UNIT, uniqueLabels } from './r1-common.js';
export function defineParetoPart(builder) {
    return {
        type: 'pareto',
        description: "A Pareto chart: causes or categories as bars from the largest down, with a cumulative-percent line, so the vital few that make up most (80%) stand out. Give the items in any order. top: N keeps the N largest and folds the rest into 'その他' (other).",
        en: { other: 'Other' },
        schema: object({
            type: { const: 'pareto' },
            items: list(object({ label: text('The cause or category.', 20), value: { ...AMOUNT, description: 'How many or how much, 0 or more.' } }, ['label', 'value']), 20, 2),
            unit: UNIT,
            top: { type: 'integer', minimum: 1, maximum: 15, description: 'Keep the N largest and fold the rest into one last bar.' },
            other: text("The name of the folded bar (default 'その他').", 20),
            guide: { oneOf: [{ type: 'integer', minimum: 50, maximum: 95 }, { type: 'boolean', enum: [false] }], description: 'The cumulative percent of the dashed guide line (default 80), or false for none.' },
            highlight: { type: 'boolean', description: 'false: one colour for every bar (default: the vital few coloured, the rest muted).' },
        }, ['type', 'items']),
        example: { type: 'pareto', unit: '件', items: [{ label: '傷', value: 42 }, { label: '汚れ', value: 25 }, { label: '欠け', value: 12 }, { label: '寸法違い', value: 8 }, { label: '色むら', value: 5 }] },
        check(part, at, issues) {
            const list = items(part, 'items');
            uniqueLabels(list, `${at}.items`, 'item', issues);
            if (list.length && list.every(i => i['value'] === 0))
                issues.push({ path: `${at}.items`, message: 'every value is 0: there is nothing to draw' });
            const top = part['top'];
            if (top !== undefined && top >= list.length)
                issues.push({ path: `${at}.top`, message: `is ${top}, but there are only ${list.length} items: leave top out` });
        },
        build(part) {
            const { items: list, ...opts } = withoutType(part);
            return builder(list, opts);
        },
    };
}
