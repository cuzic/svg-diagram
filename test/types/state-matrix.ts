// Type-level tests for stateMatrix(): required states and one cell per column. Never executed (see ids.ts).
import {stateMatrix, wf} from '../../lib/dsl.ts';

export function stateMatrixCases(): void {
  const node = wf.text('x');

  // ---- positive: one cell per column; undefined is the deliberate TODO marker; 'na' / {na} are valid ----
  stateMatrix(['通常', '空', 'エラー'], [
    {label: 'A', cells: [node, 'na', {na: '発生しない'}]},
    {label: 'B', note: 'n', cells: [node, undefined, 'todo']},
  ], {required: ['通常', '空'], cellFrame: 'none', labelW: 100});
  stateMatrix(['通常'], [{label: 'single', cells: [node]}]);
  stateMatrix(['a', 'b'], []);
  // columns held in a plain string[] are not literals: any number of cells is accepted (runtime rules still apply)
  const dynCols: string[] = ['x', 'y'];
  stateMatrix(dynCols, [{label: 'A', cells: [node]}], {required: ['anything']});

  // ---- rule wf-states-required: required must be members of cols ----
  // @ts-expect-error '読み込み中' is not a column
  stateMatrix(['通常', '空'], [{label: 'A', cells: [node, node]}], {required: ['通常', '読み込み中']});

  // ---- rule wf-states-ragged: a row with more cells than columns ----
  // @ts-expect-error three cells for two columns
  stateMatrix(['通常', '空'], [{label: 'A', cells: [node, node, node]}]);

  // ---- rule wf-states-todo: a missing cell would silently become '未設計'; write `undefined` to say so ----
  // @ts-expect-error one cell for two columns
  stateMatrix(['通常', '空'], [{label: 'A', cells: [node]}]);
  // @ts-expect-error no cells at all
  stateMatrix(['通常', '空'], [{label: 'A', cells: []}]);
  // @ts-expect-error the second row is short
  stateMatrix(['通常', '空'], [{label: 'A', cells: [node, node]}, {label: 'B', cells: [node]}]);

  // ---- cell values ----
  // @ts-expect-error a string other than 'na' / 'todo'
  stateMatrix(['通常'], [{label: 'A', cells: ['maybe']}]);
  // @ts-expect-error {na} needs the reason as a string
  stateMatrix(['通常'], [{label: 'A', cells: [{na: true}]}]);
  // @ts-expect-error unknown row option
  stateMatrix(['通常'], [{label: 'A', cells: [node], colour: 'red'}]);
}
