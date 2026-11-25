import type {StateRowLoose, ValidateStateRows} from '../strict.ts';
import type {WfNode} from '../types/wireframe-nodes.ts';
import type {ScreensBand, StateMatrixOpts, StateMatrixRow, PartRow, StateCellIn, StateMatrixCell} from '../types/wireframe.ts';
import {assertNoReveal} from './shared.ts';

// A component's states as a grid: one row per part, one column per state.
//   cols: ['通常', '読み込み中', '空', 'エラー', ...]
//   rows: [{label, note?, cells: [node | 'na' | {na: 'reason'} | undefined]}]  — a cell is a wf.* node (drawn in a light frame),
//         'na' / {na} (not applicable, drawn dashed), or missing (drawn as "未設計": a gap in the spec, which `svg-diagram check` reports).
//   opts: {required: [...cols that must exist], labelW, cellH (default: fit the content, min 72), cellFrame ('light' (default) | 'none' — 'none' when the parts already have their own border), gap, marks, skeleton}
//
// Types: `required` entries must be members of `cols` (rule wf-states-required), and each row's `cells` has EXACTLY
// cols.length entries: too many is rule wf-states-ragged, too few would silently draw '未設計' (wf-states-todo).
// An explicit `undefined` entry is still the deliberate TODO marker; 'na' / {na: reason} stay valid.
export function stateMatrix<const C extends string[], const R extends readonly (StateRowLoose | PartRow<never, string>)[]>(cols: C, rows: readonly [...R] & ValidateStateRows<C, R>, opts?: Omit<StateMatrixOpts, 'required'> & {required?: C[number][]}): ScreensBand;
export function stateMatrix(cols: string[], rowsIn: readonly (StateMatrixRow | PartRow<never>)[], opts: StateMatrixOpts = {}): ScreensBand {
  assertNoReveal(opts, 'stateMatrix()');
  const rows = rowsIn.map((r): StateMatrixRow => 'type' in r && r.type === 'part-row' ? {label: r.label, note: r.note, cells: r.cells(cols)} : r as StateMatrixRow);
  return {type: 'screens', items: [], matrix: {cols, rows, required: opts.required, labelW: opts.labelW, cellH: opts.cellH, gap: opts.gap, cellFrame: opts.cellFrame}, marks: opts.marks, skeleton: opts.skeleton, id: opts.id};
}
// One part drawn once per state: `part` is the function that builds it (the one you would call as `part({state: 'loading'})`),
// `states` says, per column, what differs from `base`:
//   {} (as is) | {state: 'loading', ...} (options merged over `base`) | 'loading' (= {state: 'loading'}) | 'na' | {na: reason} | undefined (未設計)
// Types: `states` has a key for every column of the matrix (a state left out is a type error, like a short `cells` row).
//   stateMatrix(['通常', '読み込み中', '空'], [
//     stateRow('在庫カード', stock, {通常: {}, 読み込み中: 'loading', 空: {na: '必ず 1 件ある'}}),
//     stateRow('検索結果', results, {通常: {}, 読み込み中: 'loading', 空: {state: 'empty', stateNote: '該当なし'}}, {note: '0 件のとき空'}),
//   ])
export function stateRow<const K extends string, O extends object = Record<string, unknown>, const L extends string = string>(
  label: L, part: ((o?: O) => WfNode) | ((o: O) => WfNode), states: {[P in K]: StateCellIn<NoInfer<O>>}, opts: {note?: string; base?: Partial<NoInfer<O>>} = {},
): PartRow<K, L> {
  return {
    type: 'part-row', label, note: opts.note,
    cells(cols) {
      for (const k of Object.keys(states)) if (!cols.includes(k)) throw new Error(`stateRow("${label}"): "${k}" is not a column of the matrix (${cols.join(', ')})`);
      return cols.map((col): StateMatrixCell => {
        const v = (states as Record<string, StateCellIn<O>>)[col];
        if (v === undefined || v === 'na' || v === 'todo') return v;
        const call = part as (o: O) => WfNode;
        if (typeof v === 'string') return call({...opts.base, state: v} as unknown as O);
        if (Object.keys(v).length === 1 && 'na' in v && typeof v.na === 'string') return {na: v.na}; // `{na: reason}` alone; a part's own `na` option comes with others
        return call({...opts.base, ...v} as O);
      });
    },
  };
}
