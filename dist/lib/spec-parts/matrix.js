import { items, list, object, oneOf, text } from '../spec-kit.js';
import { english, optionsOf, MATRIX_EN } from './r4-common.js';
import { matrixParts } from '../qc-table.js';
export function defineMatrixPart(builder, table) {
    return {
        type: 'matrix',
        description: 'A matrix diagram (L-shaped): options or causes as rows against criteria as columns, with ◎ (strong), ○, △ or × where they meet. With weights (the importance of each column), every row gets a score, Σ weight x value with ◎ 9, ○ 3, △ 1, × 0, and the best is marked.',
        schema: object({
            type: { const: 'matrix' },
            rows: list(text('A row heading.', 40), 12, 1),
            cols: list(text('A column heading.', 20), 8, 1),
            cells: list({ type: 'array', items: { ...oneOf('◎', '○', '△', '×', ''), description: "◎, ○, △, × or '' for none." }, minItems: 1, maxItems: 8 }, 12, 1),
            weights: list({ type: 'number', minimum: 0, maximum: 100 }, 8, 1),
            corner: text('The top-left heading, such as 案 ＼ 評価項目.', 30),
            title: text('A title bar over the table.', 40),
            total: { type: 'boolean', description: 'true: a score per row also without weights.' },
        }, ['type', 'rows', 'cols', 'cells']),
        example: { type: 'matrix', corner: '案 ＼ 評価', rows: ['A 案', 'B 案'], cols: ['コスト', '効果', '早さ'], cells: [['○', '◎', '△'], ['◎', '△', '○']], weights: [5, 4, 3] },
        en: { lang: 'en' },
        check(part, at, issues) {
            const rows = items(part, 'rows').length, cols = items(part, 'cols').length, cells = part['cells'];
            if (cells.length !== rows)
                issues.push({ path: `${at}.cells`, message: `has ${cells.length} rows; there are ${rows} rows` });
            cells.forEach((r, i) => { if (r.length !== cols)
                issues.push({ path: `${at}.cells[${i}]`, message: `has ${r.length} cells; there are ${cols} columns` }); });
            const w = part['weights'];
            if (w && w.length !== cols)
                issues.push({ path: `${at}.weights`, message: `has ${w.length} weights; there are ${cols} columns` });
        },
        build(part) {
            const { rows, cols, cells, ...opts } = optionsOf(part);
            if (!english(part))
                return builder(rows, cols, cells, opts);
            // the builder writes its score and weight headings in Japanese: the same table, with those words in English
            const p = matrixParts(rows, cols, cells, opts);
            const en = (s) => typeof s === 'string' ? MATRIX_EN[s] ?? s : s;
            const columns = p.columns.map(c => ({ ...c, label: en(c.label) }));
            const body = p.rows.map(r => Array.isArray(r) ? r.map(en) : { ...r, cells: r.cells.map(en) });
            return table(columns, body, p.opts);
        },
    };
}
