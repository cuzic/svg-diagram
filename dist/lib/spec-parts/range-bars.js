import { AMOUNT, items, list, object, oneOf, text, withoutType } from '../spec-kit.js';
import { UNIT, uniqueLabels } from './r6-common.js';
export function defineRangeBarsPart(builder) {
    return {
        type: 'rangeBars',
        description: 'Range bars: one bar per label from a low to a high value, such as the price range of each plan, an estimate range or a minimum and maximum. Values are 0 or more.',
        schema: object({
            type: { const: 'rangeBars' },
            items: list(object({ label: text('What the bar is.', 30), low: { ...AMOUNT, description: 'Where the bar starts.' }, high: { ...AMOUNT, description: 'Where it ends, above low.' }, tone: oneOf('accent', 'danger', 'muted') }, ['label', 'low', 'high']), 20, 1),
            unit: UNIT,
            dir: { ...oneOf('v', 'h'), description: 'h (default): one bar per row. v: side by side.' },
            decimals: { type: 'integer', minimum: 0, maximum: 3, description: 'Decimals of the value labels.' },
        }, ['type', 'items']),
        example: { type: 'rangeBars', unit: '万円', items: [{ label: '設計', low: 80, high: 120 }, { label: '開発', low: 200, high: 340, tone: 'accent' }, { label: 'テスト', low: 60, high: 110 }] },
        check(part, at, issues) {
            const list = items(part, 'items');
            uniqueLabels(list, `${at}.items`, 'bar', issues);
            list.forEach((r, i) => { if (!(r['high'] > r['low']))
                issues.push({ path: `${at}.items[${i}].high`, message: `must be above low (${String(r['low'])})` }); });
        },
        build(part) {
            const { items: rows, decimals, ...opts } = withoutType(part);
            return builder(rows.map(({ low, high, ...r }) => ({ ...r, range: [low, high] })), { ...opts, ...(decimals === undefined ? {} : { valueFormat: decimals }) });
        },
        en: { rangeMark: '–' },
    };
}
