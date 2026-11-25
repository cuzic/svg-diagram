import { at } from './finding-rules.js';
import { toneStyle } from './tokens.js';
export const tableRules = /* @__PURE__ */ Object.freeze({
    'rowheader-tone-collides': { doc: '表の行ラベル（rowHeader）と同じ塗り（soft）の行トーンがある', scope: 'band' },
    'semantic-table-warning': { doc: '意味付き表の入力に注意点がある（例: RACI の空の役割列）', scope: 'band' },
    'table-sum-mismatch': { doc: '表の「合計」行・列の値が、並ぶ値の和と合わない（丸めで説明できる差は除く）', scope: 'band' },
    'table-share-not-100': { doc: '表の「構成比」「割合」の列が、合計 100% にならない', scope: 'band' },
});
export function semanticTableFindings(b) {
    return (b.semanticWarnings ?? []).map(message => ({ ...at(b), rule: 'semantic-table-warning', severity: 'warn', message }));
}
// rowHeader paints the heading cell soft, so a row with the same fill loses the distinction.
export function rowHeaderFindings(b, tones) {
    if (!b.rowHeader)
        return [];
    const rows = b.rows.filter(r => !r.header && toneStyle(tones, r.tone).fill === 'soft');
    if (!rows.length)
        return [];
    const names = rows.slice(0, 4).map(r => `「${(r.cells[0]?.lines[0] ?? '').slice(0, 12)}」`).join('');
    return [{ ...at(b), rule: 'rowheader-tone-collides', severity: 'warn', message: `表の行ラベルは soft で塗るが、${names}${rows.length > 4 ? ` ほか ${rows.length - 4} 行` : ''}は行のトーン（${[...new Set(rows.map(r => r.tone))].join('・')}）も soft なので、行ラベルと本文の塗りが同じになる。muted / changed / 太字の文字などに変えるか、行のトーンを外す` }];
}
