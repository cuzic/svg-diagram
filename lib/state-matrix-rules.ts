import {at} from './finding-rules.ts';
import type {Finding} from './types/verdicts.ts';
import type {ScreensBand} from './types/wireframe.ts';

export function stateMatrixFindings(b: ScreensBand): Finding[] {
  if (!b.matrix) return [];
  const out: Finding[] = [];
  const m = b.matrix;
  const miss = (m.required ?? []).filter(c => !m.cols.includes(c));
  if (miss.length) out.push({...at(b), rule: 'wf-states-required', severity: 'warn', message: `状態の一覧に、必須の状態「${miss.join('」「')}」の列がない`});
  const todo: string[] = [];
  for (const row of m.rows) {
    if (row.cells.length > m.cols.length) out.push({...at(b), rule: 'wf-states-ragged', severity: 'warn', message: `行「${row.label}」の欄が ${row.cells.length} 個で、列（${m.cols.length}）より多い`});
    m.cols.forEach((col, i) => { const c = row.cells[i]; if (c == null || c === 'todo') todo.push(`${row.label}×${col}`); }); // a row shorter than the columns leaves "未設計" cells
  }
  if (todo.length) out.push({...at(b), rule: 'wf-states-todo', severity: 'warn', message: `「未設計」の欄: ${todo.join('、')}`});
  return out;
}

export const stateMatrixRules = /* @__PURE__ */ Object.freeze({
  'wf-states-todo': {doc: '状態の一覧に「未設計」の欄がある（設計するか、対象外と明示する）', scope: 'band'},
  'wf-states-required': {doc: '状態の一覧に、必須の状態の列がない', scope: 'band'},
  'wf-states-ragged': {doc: '状態の一覧の行に、列より多い欄がある', scope: 'band'},
} as const);
