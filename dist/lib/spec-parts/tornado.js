import { NUM, items, list, object, text, withoutType } from '../spec-kit.js';
import { unit } from './r2-common.js';
export function defineTornadoPart(builder) {
    return {
        type: 'tornado',
        description: 'A tornado chart: how much a result moves when each input goes from its low to its high value, longest bar first, such as the sensitivity of a profit forecast. `base` is the result of the base case.',
        schema: object({
            type: { const: 'tornado' },
            base: { ...NUM, description: 'The result of the base case: the line the bars start from.' },
            items: list(object({
                label: text('The input that varies, with its range if useful.', 30),
                low: { ...NUM, description: 'The result when this input is at its low value.' },
                high: { ...NUM, description: 'The result when this input is at its high value.' },
            }, ['label', 'low', 'high']), 12, 1),
            unit: unit(),
            lowLabel: text('The name of the low case (default 低ケース).', 20),
            highLabel: text('The name of the high case (default 高ケース).', 20),
            baseLabel: text('The name of the base line (default 基準).', 20),
            sort: { type: 'boolean', description: 'false: keep the order given instead of the longest first.' },
        }, ['type', 'base', 'items']),
        example: { type: 'tornado', base: 100, unit: '百万円', items: [{ label: '販売単価 ±10%', low: 70, high: 130 }, { label: '販売数量 ±10%', low: 82, high: 118 }, { label: '原材料費 ±10%', low: 112, high: 88 }] },
        check(part, at, issues) {
            items(part, 'items').forEach((it, i) => { if (it['low'] === it['high'] && it['low'] === part['base'])
                issues.push({ path: `${at}.items[${i}]`, message: 'moves the result neither way: leave it out' }); });
        },
        build(part) {
            const { items: rows, sort, ...opts } = withoutType(part);
            return builder(rows, { ...opts, ...(sort === false ? { sort: false } : {}) });
        },
        en: { lowLabel: 'Low case', highLabel: 'High case', baseLabel: 'Base' },
    };
}
