import type { ChartGeom, ChartOpts, LaidOutChartPart } from './charts-base.ts';
import type { MatrixMark } from './qc-table.ts';
import type { CellMark } from './types/sequence-table-swimlane.ts';
/** One cell: the rating and why, or null for a cell that is not rated (drawn as a dash). */
export type CompareCell = readonly [mark: Exclude<MatrixMark, '' | undefined>, note: string] | null;
export interface CompareOpts extends ChartOpts {
    /** The text in the top left corner (what the rows are: 比較軸). */
    corner?: string;
}
export interface CompareSpec {
    rows: string[];
    cols: string[];
    cells: ({
        mark: CellMark;
        note: string;
    } | null)[][];
    corner: string;
}
export declare function resolveCompare(rows: readonly string[], cols: readonly string[], cells: readonly (readonly CompareCell[])[], opts?: CompareOpts): CompareSpec;
export declare function compareAlt(s: CompareSpec): string;
export declare function compareTexts(s: CompareSpec): [string, number][];
export declare function layoutCompare(s: CompareSpec, g: ChartGeom): LaidOutChartPart;
