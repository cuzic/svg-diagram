import { AMOUNT, items, list, object, text } from '../spec-kit.js';
import { lengthIs, uniqueTexts } from './r5-common.js';
export function defineMekkoPart(builder) {
    return {
        type: 'mekko',
        description: 'A Mekko (Marimekko) chart: the width of a column is its total and the height of a part its share, so each area is its share of the whole, such as market size by segment and the share of each company in it.',
        schema: object({
            type: { const: 'mekko' },
            series: list(text('A part of every column (a company, a product).', 20), 6, 2),
            columns: list(object({ label: text('The column (a segment, a market).', 20), values: { ...list(AMOUNT, 6, 2), description: 'One per series.' } }, ['label', 'values']), 8, 2),
            unit: text('Written after every total (億円, %).', 8),
        }, ['type', 'series', 'columns']),
        example: { type: 'mekko', unit: '億円', series: ['A 社', 'B 社', 'その他'], columns: [{ label: '法人', values: [40, 25, 15] }, { label: '個人', values: [10, 20, 30] }] },
        check(part, at, issues) {
            const n = part['series'].length;
            uniqueTexts(part['series'], `${at}.series`, 'series', issues);
            uniqueTexts(part['columns'], `${at}.columns`, 'column', issues, 'label');
            items(part, 'columns').forEach((c, i) => {
                lengthIs(c['values'], n, `${at}.columns[${i}].values`, 'series', issues);
                if (c['values'].every(v => v === 0))
                    issues.push({ path: `${at}.columns[${i}].values`, message: 'are all 0: a column needs a total to have a width' });
            });
        },
        build(part) {
            const series = part['series'];
            const columns = items(part, 'columns').map(c => ({ label: c['label'], parts: c['values'].map((value, i) => ({ label: series[i], value })) }));
            return builder(columns, { ...(part['unit'] === undefined ? {} : { unit: part['unit'] }), ...(part['totalLabel'] === undefined ? {} : { totalLabel: part['totalLabel'] }), ...(part['brackets'] === undefined ? {} : { brackets: part['brackets'] }) });
        },
        en: { totalLabel: 'Total', brackets: [' (', ')'] },
    };
}
