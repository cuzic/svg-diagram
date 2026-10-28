import type { CellMark, TableColumn, TableOpts, TableRow } from './types/sequence-table-swimlane.ts';
/** The tally marks of the Japanese check sheet: 一 丅 下 止 are 1 to 4 strokes, 正 is 5 (and is written again for the next five). */
export declare function tally(n: number): string;
export interface CheckItem {
    label: string; /** The counts, one per column. Omitted: an empty row to fill in by hand. */
    counts?: readonly number[];
}
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
export declare function checkSheetParts(items: readonly (string | CheckItem)[], columns: readonly string[], opts?: CheckSheetOpts): {
    columns: TableColumn[];
    rows: TableRow[];
    opts: TableOpts;
};
export type MatrixMark = CellMark | '◎' | '○' | '△' | '×' | '' | undefined;
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
export declare const markOf: (m: MatrixMark, where: string) => CellMark | undefined;
/** The scores of the rows, from the marks and the weights. */
export declare function matrixScores(marks: readonly (readonly (CellMark | undefined)[])[], weights?: readonly number[], values?: Partial<Record<CellMark, number>>): number[];
export declare function matrixParts(rowLabels: readonly string[], colLabels: readonly string[], cells: readonly (readonly MatrixMark[])[], opts?: MatrixOpts): {
    columns: TableColumn[];
    rows: TableRow[];
    opts: TableOpts;
};
