import { BOX_TONE, CELL, items, list, object, text, withoutType } from '../spec-kit.js';
export function defineTablePart(builder) {
    return {
        type: 'table',
        description: 'A table: columns with headings and rows of text or numbers, such as a comparison of options. A row can be an object with a tone to stand out.',
        schema: object({
            type: { const: 'table' },
            columns: list(object({ label: text('The heading.', 30), flex: { type: 'integer', minimum: 1, maximum: 6, description: 'The share of the width (default 1).' } }, ['label']), 8, 1),
            rows: list({ oneOf: [
                    { type: 'array', items: CELL, minItems: 1, maxItems: 8, description: 'The cells, one per column.' },
                    object({ cells: { type: 'array', items: CELL, minItems: 1, maxItems: 8 }, tone: BOX_TONE }, ['cells']),
                ] }, 30, 1),
            title: text('A title bar over the table.', 40),
            rowHeader: { type: 'boolean', description: 'true: the first column is a heading for its row.' },
            dense: { type: 'boolean', description: 'true: tighter rows.' },
        }, ['type', 'columns', 'rows']),
        example: { type: 'table', title: 'プランの比較', rowHeader: true, columns: [{ label: '項目' }, { label: 'ライト' }, { label: 'スタンダード' }, { label: 'プロ' }], rows: [['月額', '980 円', '2,980 円', '9,800 円'], ['利用人数', '1 人', '10 人', '無制限'], { cells: ['サポート', 'メール', 'メール・チャット', '専任担当'], tone: 'accent' }] },
        check(part, at, issues) {
            const n = items(part, 'columns').length;
            part['rows'].forEach((r, i) => {
                const cells = Array.isArray(r) ? r : r['cells'];
                if (Array.isArray(cells) && cells.length !== n)
                    issues.push({ path: `${at}.rows[${i}]`, message: `has ${cells.length} cells; the table has ${n} columns` });
            });
        },
        build(part) {
            const { columns, rows, ...opts } = withoutType(part);
            return builder(columns, rows, opts);
        },
    };
}
