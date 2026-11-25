import { NUM, items, list, object, text, withoutType } from '../spec-kit.js';
import { unit, minBelowMax } from './r2-common.js';
const MAX_HEATMAP_ROWS = 15, MAX_HEATMAP_COLS = 12;
export function defineHeatmapPart(builder) {
    return {
        type: 'heatmap',
        description: 'A heatmap: a table of numbers shaded by size, such as sales by month and store or a cohort retention. Every cell has a number; the darker, the larger.',
        schema: object({
            type: { const: 'heatmap' },
            rows: list(text('A row name.', 20), MAX_HEATMAP_ROWS, 1),
            cols: list(text('A column name.', 12), MAX_HEATMAP_COLS, 1),
            values: list({ type: 'array', items: NUM, minItems: 1, maxItems: MAX_HEATMAP_COLS, description: 'One number per column.' }, MAX_HEATMAP_ROWS, 1),
            unit: unit(),
            decimals: { type: 'integer', minimum: 0, maximum: 2, description: 'Decimals to print (default: as the data has, at most 2).' },
            min: { ...NUM, description: 'The value of the lightest shade (default: the smallest).' },
            max: { ...NUM, description: 'The value of the darkest shade (default: the largest).' },
            levels: { type: 'integer', minimum: 3, maximum: 6, description: 'How many shades (default 5).' },
            corner: text("The top-left heading, naming the rows and the columns ('店舗 ＼ 月').", 20),
            scale: { type: 'boolean', description: 'false: no legend of the shades.' },
        }, ['type', 'rows', 'cols', 'values']),
        example: { type: 'heatmap', unit: '%', corner: '登録月 ＼ 経過月', rows: ['4月', '5月', '6月'], cols: ['1か月', '2か月', '3か月'], values: [[62, 48, 40], [58, 45, 37], [66, 52, 44]] },
        check(part, at, issues) {
            const rows = items(part, 'rows').length, cols = items(part, 'cols').length, values = part['values'];
            if (values.length !== rows)
                issues.push({ path: `${at}.values`, message: `has ${values.length} rows; there are ${rows} rows` });
            values.forEach((r, i) => { if (r.length !== cols)
                issues.push({ path: `${at}.values[${i}]`, message: `has ${r.length} numbers; there are ${cols} columns` }); });
            minBelowMax(part, at, issues);
        },
        build(part) {
            const { rows, cols, values, ...opts } = withoutType(part);
            return builder(rows, cols, values, opts);
        },
        en: { legendTitle: 'Legend', rangeMark: '–' },
    };
}
