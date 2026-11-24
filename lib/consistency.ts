// Consistency rules that read the words and numbers a diagram's author typed: spelling variants of one term
// (ユーザ / ユーザー, API / Api), project-glossary terms to avoid (.svg-diagram.json "terms"), and tables whose
// 合計 row / column does not add up. Pure: bands in, findings out.
import {at} from './finding-rules.ts';
import type {Band} from './types/index.ts';
import type {TableBand, TableCell, TableRow} from './types/sequence-table-swimlane.ts';
import type {Finding} from './types/verdicts.ts';

export {termFindings, termVariants, textsOf} from './term-rules.ts';

// ---- numbers in tables ----------------------------------------------------------------------
const UNIT = '(%|％|円|万円|億円|千円|件|人|台|個|k|M|ms|s)?';
const NUM = new RegExp(`^[¥￥$]?\\s*(-?[\\d,]+(?:\\.\\d+)?)\\s*${UNIT}$`);
const TOTAL_WORD = /^(合計|総計|計|小計|総数|全体|total|sum|subtotal)$/i;
const SHARE_HEAD = /(構成比|割合|比率|シェア|share|%)/i;
export interface Num {value: number; decimals: number; unit: string}
export function parseNum(text: string): Num | null {
  const m = NUM.exec(text.trim());
  if (!m) return null;
  const raw = (m[1] ?? '').replace(/,/g, '');
  if (raw === '-' || raw === '') return null;
  return {value: Number(raw), decimals: raw.includes('.') ? (raw.split('.')[1] ?? '').length : 0, unit: (m[2] ?? '').replace('％', '%')};
}
const cellText = (c: TableCell | undefined): string => c === undefined ? '' : typeof c === 'string' ? c : typeof c === 'number' ? String(c) : c.text ?? '';
const cellsOf = (r: TableRow): readonly TableCell[] => Array.isArray(r) ? r : (r as {cells: readonly TableCell[]}).cells;

// the sum of `nums` must be `total`, give or take what rounding to the shown decimals can explain
function mismatch(nums: Num[], total: Num): number | null {
  if (!nums.length || nums.some(n => n.unit !== total.unit)) return null;
  const d = Math.max(total.decimals, ...nums.map(n => n.decimals));
  const sum = parseFloat(nums.reduce((a, n) => a + n.value, 0).toFixed(d + 2));
  const ulp = 10 ** -d, tol = 0.5 * ulp * (total.unit === '%' ? nums.length : 1) + 1e-9;
  return Math.abs(sum - total.value) > tol ? sum : null;
}
const show = (v: number, unit: string, d: number): string => `${parseFloat(v.toFixed(d))}${unit}`;

export function tableFindings(bands: readonly Band[]): Finding[] {
  const out: Finding[] = [];
  for (const b of bands) {
    if (b.type !== 'table') continue;
    const t = b as TableBand, name = t.title ? `表「${t.title}」` : '表';
    const grid = t.rows.map(r => cellsOf(r).map(cellText));
    const isTotalRow = grid.map(r => TOTAL_WORD.test((r[0] ?? '').trim()));
    // a 合計 row: each column's numbers above it (not past an earlier 小計 / 合計) add up to it
    grid.forEach((row, i) => {
      if (!isTotalRow[i]) return;
      const sub = /^(小計|subtotal)$/i.test((row[0] ?? '').trim());
      for (let c = 1; c < row.length; c++) {
        const total = parseNum(row[c] ?? '');
        if (!total) continue;
        const above: Num[] = [], subs: Num[] = [];
        for (let j = i - 1; j >= 0; j--) {
          const gj = grid[j] ?? [];
          if (isTotalRow[j]) { const n = parseNum(gj[c] ?? ''); if (/^(小計|subtotal)$/i.test((gj[0] ?? '').trim()) && !sub && n) { subs.push(n); continue; } break; }
          const n = parseNum(gj[c] ?? ''); if (n) above.push(n);
        }
        const bad = mismatch(above, total);
        if (bad !== null && (sub || mismatch(subs, total) !== null || !subs.length)) out.push({...at(t), rule: 'table-sum-mismatch', severity: 'warn', message: `${name}の「${(row[0] ?? '').trim()}」行 ${c + 1} 列目が ${show(total.value, total.unit, total.decimals)} だが、上の値の和は ${show(bad, total.unit, Math.max(total.decimals, ...above.map(n => n.decimals)))}`});
      }
    });
    // a 合計 column: the numbers to its left in each row add up to it
    t.columns.forEach((col, c) => {
      if (c === 0 || !TOTAL_WORD.test((col.label ?? '').trim())) return;
      grid.forEach((row, i) => {
        if (isTotalRow[i]) return;
        const total = parseNum(row[c] ?? '');
        const left = row.slice(1, c).map(parseNum).filter((n): n is Num => n !== null);
        const bad = total ? mismatch(left, total) : null;
        if (total && bad !== null) out.push({...at(t), rule: 'table-sum-mismatch', severity: 'warn', message: `${name}の「${(row[0] ?? '').trim()}」行の「${col.label}」が ${show(total.value, total.unit, total.decimals)} だが、左の値の和は ${show(bad, total.unit, Math.max(total.decimals, ...left.map(n => n.decimals)))}`});
      });
    });
    // a share column (構成比 / 割合) with no 合計 row should add up to 100%
    t.columns.forEach((col, c) => {
      if (c === 0 || !SHARE_HEAD.test(col.label ?? '') || isTotalRow.some(Boolean)) return;
      const nums = grid.map(r => parseNum(r[c] ?? '')).filter((n): n is Num => n !== null);
      if (nums.length < 2 || nums.some(n => n.unit !== '%')) return;
      const bad = mismatch(nums, {value: 100, decimals: 0, unit: '%'});
      if (bad !== null) out.push({...at(t), rule: 'table-share-not-100', severity: 'warn', message: `${name}の「${col.label}」列の合計が ${show(bad, '%', Math.max(...nums.map(n => n.decimals)))}（100% にならない。割合の取りこぼしか、複数選択なら見出しで断る）`});
    });
  }
  return out;
}
