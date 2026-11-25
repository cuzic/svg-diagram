import { assertNoReveal } from './shared.js';
export function stateMatrix(cols, rowsIn, opts = {}) {
    assertNoReveal(opts, 'stateMatrix()');
    const rows = rowsIn.map((r) => 'type' in r && r.type === 'part-row' ? { label: r.label, note: r.note, cells: r.cells(cols) } : r);
    return { type: 'screens', items: [], matrix: { cols, rows, required: opts.required, labelW: opts.labelW, cellH: opts.cellH, gap: opts.gap, cellFrame: opts.cellFrame }, marks: opts.marks, skeleton: opts.skeleton, id: opts.id };
}
// One part drawn once per state: `part` is the function that builds it (the one you would call as `part({state: 'loading'})`),
// `states` says, per column, what differs from `base`:
//   {} (as is) | {state: 'loading', ...} (options merged over `base`) | 'loading' (= {state: 'loading'}) | 'na' | {na: reason} | undefined (未設計)
// Types: `states` has a key for every column of the matrix (a state left out is a type error, like a short `cells` row).
//   stateMatrix(['通常', '読み込み中', '空'], [
//     stateRow('在庫カード', stock, {通常: {}, 読み込み中: 'loading', 空: {na: '必ず 1 件ある'}}),
//     stateRow('検索結果', results, {通常: {}, 読み込み中: 'loading', 空: {state: 'empty', stateNote: '該当なし'}}, {note: '0 件のとき空'}),
//   ])
export function stateRow(label, part, states, opts = {}) {
    return {
        type: 'part-row', label, note: opts.note,
        cells(cols) {
            for (const k of Object.keys(states))
                if (!cols.includes(k))
                    throw new Error(`stateRow("${label}"): "${k}" is not a column of the matrix (${cols.join(', ')})`);
            return cols.map((col) => {
                const v = states[col];
                if (v === undefined || v === 'na' || v === 'todo')
                    return v;
                const call = part;
                if (typeof v === 'string')
                    return call({ ...opts.base, state: v });
                if (Object.keys(v).length === 1 && 'na' in v && typeof v.na === 'string')
                    return { na: v.na }; // `{na: reason}` alone; a part's own `na` option comes with others
                return call({ ...opts.base, ...v });
            });
        },
    };
}
