import { items, list, object, text, withoutType } from '../spec-kit.js';
import { lengthIs, uniqueTexts } from './r5-common.js';
export function defineHarveyPart(builder) {
    return {
        type: 'harvey',
        description: 'Harvey balls: a table of options (columns) rated on criteria (rows) with circles filled from 0 (empty) to 4 (full), such as a comparison of products or vendors. A legend names the five levels.',
        schema: object({
            type: { const: 'harvey' },
            rows: list(text('A criterion.', 30), 15, 1),
            cols: list(text('An option.', 20), 8, 1),
            values: list({ type: 'array', items: { type: 'integer', minimum: 0, maximum: 4, description: '0 (empty) to 4 (full).' }, minItems: 1, maxItems: 8, description: 'One per column.' }, 15, 1),
            corner: text('The top-left heading.', 20),
            levels: { type: 'array', items: text('A level.', 10), minItems: 5, maxItems: 5, description: 'The names of 0 to 4 in the legend (default なし, 一部, 半分, ほぼ, 十分).' },
            highlight: list(text('A column name.', 20), 3),
        }, ['type', 'rows', 'cols', 'values']),
        example: { type: 'harvey', corner: '評価項目', rows: ['価格', '機能', 'サポート'], cols: ['A 社', 'B 社', 'C 社'], values: [[4, 2, 3], [2, 4, 3], [1, 3, 4]] },
        en: { levels: ['None', 'Some', 'Half', 'Most', 'Full'] },
        check(part, at, issues) {
            const rows = part['rows'], cols = part['cols'], values = part['values'];
            uniqueTexts(rows, `${at}.rows`, 'row', issues);
            uniqueTexts(cols, `${at}.cols`, 'column', issues);
            if (values.length !== rows.length)
                issues.push({ path: `${at}.values`, message: `has ${values.length} rows; there are ${rows.length} rows` });
            values.forEach((r, i) => lengthIs(r, cols.length, `${at}.values[${i}]`, 'columns', issues));
            items(part, 'highlight').forEach((h, i) => { if (!cols.includes(h))
                issues.push({ path: `${at}.highlight[${i}]`, message: `${JSON.stringify(h)} is not a column (known: ${cols.join(', ')})` }); });
        },
        build(part) {
            const { rows, cols, values, ...opts } = withoutType(part);
            return builder(rows, cols, values, opts);
        },
    };
}
