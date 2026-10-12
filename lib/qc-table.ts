// The QC tools that are a table: the check sheet (チェックシート) with its tally marks, and the matrix diagram (マトリックス図) with its
// ◎ ○ △ symbols and the scores they add up to. Both only work out the columns, rows and options of a table().
import type {CellMark, TableCellSpec, TableColumn, TableOpts, TableRow} from './types.ts';

/** The tally marks of the Japanese check sheet: 一 丅 下 止 are 1 to 4 strokes, 正 is 5 (and is written again for the next five). */
export function tally(n: number): string {
  if (!(Number.isInteger(n) && n >= 0)) throw new Error(`tally(n): n must be a whole number >= 0 (got ${n})`);
  return '正'.repeat(Math.floor(n / 5)) + ['', '一', '丅', '下', '止'][n % 5];
}

// ---- check sheet -------------------------------------------------------------------------------------------------------------

export interface CheckItem {label: string; /** The counts, one per column. Omitted: an empty row to fill in by hand. */ counts?: readonly number[]}
export interface CheckSheetOpts extends Pick<TableOpts, 'title' | 'width' | 'cellH' | 'dense' | 'id' | 'reveal' | 'until'> {
  /** The text of the top-left cell (what the rows are: 不良の種類). */
  corner?: string;
  /** How a count is written: 'tally' (正 marks; default), 'number', or 'both' (正丅 7). */
  as?: 'tally' | 'number' | 'both';
  /** The row and the column of totals (default: true when there are counts). */
  total?: boolean;
  /** A ☐ in every empty cell: a sheet of points to tick off by hand rather than to count on. */
  boxes?: boolean;
}

export function checkSheetParts(items: readonly (string | CheckItem)[], columns: readonly string[], opts: CheckSheetOpts = {}): {columns: TableColumn[]; rows: TableRow[]; opts: TableOpts} {
  if (!Array.isArray(items) || items.length === 0) throw new Error('checkSheet(items, columns) needs at least one item');
  if (!Array.isArray(columns) || columns.length === 0) throw new Error('checkSheet(items, columns) needs at least one column');
  const rows = items.map(i => typeof i === 'string' ? {label: i} : i);
  for (const r of rows) {
    if (typeof r.label !== 'string' || !r.label.trim()) throw new Error('checkSheet(): every item needs a label');
    if (r.counts !== undefined && r.counts.length !== columns.length) throw new Error(`checkSheet(): item "${r.label}" has ${r.counts.length} counts for ${columns.length} columns`);
    if (r.counts?.some((c: number) => !(Number.isInteger(c) && c >= 0))) throw new Error(`checkSheet(): the counts of "${r.label}" must be whole numbers >= 0`);
  }
  if (opts.as !== undefined && !['tally', 'number', 'both'].includes(opts.as)) throw new Error(`checkSheet(): as must be 'tally', 'number' or 'both' (got ${String(opts.as)})`);
  const counted = rows.some(r => r.counts !== undefined), as = opts.as ?? 'tally';
  const withTotal = opts.total ?? counted;
  if (withTotal && !counted) throw new Error('checkSheet(): total needs counts');
  const text = (n: number): string => n === 0 ? '' : as === 'number' ? String(n) : as === 'both' ? `${tally(n)} ${n}` : tally(n);
  const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
  const cols: TableColumn[] = [{label: opts.corner ?? '', flex: 2, bold: true}, ...columns.map(label => ({label, flex: 1, align: 'center' as const})), ...(withTotal ? [{label: '計', flex: 1, align: 'center' as const, bold: true}] : [])];
  const body: TableRow[] = rows.map(r => [
    r.label,
    ...columns.map((_, j): TableCellSpec | string => r.counts ? text(r.counts[j]) : opts.boxes ? '☐' : ''),
    ...(withTotal ? [{text: r.counts ? String(sum(r.counts)) : '', bold: true}] : []),
  ]);
  if (withTotal) {
    const per = columns.map((_, j) => sum(rows.map(r => r.counts?.[j] ?? 0)));
    body.push({cells: ['計', ...per.map(n => ({text: String(n), bold: true})), {text: String(sum(per)), bold: true}], tone: 'muted'});
  }
  const {corner: _c, as: _a, total: _t, boxes: _b, ...rest} = opts;
  return {columns: cols, rows: body, opts: {...rest, rowHeader: true}};
}

// ---- matrix diagram ----------------------------------------------------------------------------------------------------------

export type MatrixMark = CellMark | '◎' | '○' | '△' | '×' | '' | undefined;
const GLYPH_MARK: Record<string, CellMark> = {'◎': 'best', '○': 'ok', '△': 'mid', '×': 'ng'};
export interface MatrixOpts extends Pick<TableOpts, 'title' | 'width' | 'cellH' | 'dense' | 'id' | 'reveal' | 'until'> {
  /** The text of the top-left cell (what the rows and the columns are: 案 ＼ 評価項目). */
  corner?: string;
  /** How much each column counts (its importance): written in a row of its own, and the scores become Σ weight × value. */
  weights?: readonly number[];
  /** What each mark is worth in a score (default best 9, ok 3, mid 1, ng 0: the QFD scale). */
  values?: Partial<Record<CellMark, number>>;
  /** A score at the end of every row (default: when `weights` is given). */
  total?: boolean;
  /** The best row's score is marked (default true when there is a total). */
  highlight?: boolean;
}
const VALUES: Record<CellMark, number> = {best: 9, ok: 3, mid: 1, ng: 0};

export const markOf = (m: MatrixMark, where: string): CellMark | undefined => {
  if (m === undefined || m === '') return undefined;
  const k = GLYPH_MARK[m] ?? m;
  if (!['best', 'ok', 'mid', 'ng'].includes(k)) throw new Error(`matrix(): ${where} has mark ${JSON.stringify(m)} (use ◎ ○ △ × or best / ok / mid / ng)`);
  return k as CellMark;
};

/** The scores of the rows, from the marks and the weights. */
export function matrixScores(marks: readonly (readonly (CellMark | undefined)[])[], weights?: readonly number[], values: Partial<Record<CellMark, number>> = {}): number[] {
  const v = {...VALUES, ...values};
  return marks.map(r => r.reduce<number>((n, m, j) => n + (m ? v[m] : 0) * (weights?.[j] ?? 1), 0));
}

export function matrixParts(rowLabels: readonly string[], colLabels: readonly string[], cells: readonly (readonly MatrixMark[])[], opts: MatrixOpts = {}): {columns: TableColumn[]; rows: TableRow[]; opts: TableOpts} {
  if (!Array.isArray(rowLabels) || rowLabels.length === 0) throw new Error('matrix(rows, cols, cells) needs at least one row');
  if (!Array.isArray(colLabels) || colLabels.length === 0) throw new Error('matrix(rows, cols, cells) needs at least one column');
  if (cells.length !== rowLabels.length) throw new Error(`matrix(): cells has ${cells.length} rows for ${rowLabels.length} row labels`);
  const marks = cells.map((r, i) => {
    if (r.length !== colLabels.length) throw new Error(`matrix(): row "${rowLabels[i]}" has ${r.length} cells for ${colLabels.length} columns`);
    return r.map((m, j) => markOf(m, `the cell of "${rowLabels[i]}" x "${colLabels[j]}"`));
  });
  const {weights} = opts;
  if (weights !== undefined) {
    if (weights.length !== colLabels.length) throw new Error(`matrix(): weights has ${weights.length} numbers for ${colLabels.length} columns`);
    if (!weights.every(w => Number.isFinite(w) && w >= 0)) throw new Error('matrix(): every weight must be a number >= 0');
  }
  for (const [k, v] of Object.entries(opts.values ?? {})) if (!['best', 'ok', 'mid', 'ng'].includes(k) || !Number.isFinite(v)) throw new Error(`matrix(): values has ${k}: ${v} (keys best / ok / mid / ng, numbers)`);
  const withTotal = opts.total ?? weights !== undefined;
  const scores = matrixScores(marks, weights, opts.values), top = Math.max(...scores), best = top > 0 && scores.filter(v => v === top).length === 1; // a tie, or nothing scored, has no best row
  const cols: TableColumn[] = [{label: opts.corner ?? '', flex: 2, bold: true}, ...colLabels.map(label => ({label, flex: 1, align: 'center' as const})), ...(withTotal ? [{label: weights ? '評価点' : '合計', flex: 1, align: 'center' as const, bold: true}] : [])];
  const rows: TableRow[] = [];
  if (weights) rows.push({cells: ['重み', ...weights.map(w => ({text: String(w), align: 'center' as const, tone: 'muted' as const})), ...(withTotal ? [''] : [])], tone: 'muted'});
  rowLabels.forEach((label, i) => rows.push([
    label,
    ...marks[i].map((m): TableCellSpec => m ? {text: '', mark: m, align: 'center'} : {text: '', align: 'center'}),
    ...(withTotal ? [best && scores[i] === top && opts.highlight !== false && rowLabels.length > 1 ? {text: String(scores[i]), tone: 'accent' as const, bold: true, mark: 'best' as const, align: 'center' as const} : {text: String(scores[i]), align: 'center' as const}] : []),
  ]));
  const {corner: _c, weights: _w, values: _v, total: _t, highlight: _h, ...rest} = opts;
  return {columns: cols, rows, opts: {...rest, rowHeader: true}};
}
