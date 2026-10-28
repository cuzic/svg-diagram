import type { ChartGeom, ChartOpts, LaidOutChartPart } from './charts-base.ts';
export interface HeatmapOpts extends ChartOpts {
    /** Written after every number ('%', '件'). */
    unit?: string;
    /** Decimals to print (default: as many as the data has, at most 2). */
    decimals?: number;
    /** The values the lightest / the darkest step stand for (default: the smallest / the largest value). Values outside are clamped. */
    min?: number;
    max?: number;
    /** How many shades (3-6, default 5). */
    levels?: number;
    /** Row labels in the table's row-heading style: bold, with a rule after them (default true). */
    rowHeader?: boolean;
    /** The text of the top-left corner (the name of the rows and of the columns: '登録月 ＼ 経過月'). */
    corner?: string;
    /** The legend of the shades (default true). */
    scale?: boolean;
    /** Row height (default from the text size). */
    cellH?: number;
}
export interface HeatmapSpec {
    rows: string[];
    cols: string[];
    values: (number | null)[][];
    unit: string;
    decimals: number;
    min: number;
    max: number;
    levels: number;
    rowHeader: boolean;
    corner: string;
    scale: boolean;
    cellH?: number;
}
export declare function resolveHeatmap(rows: readonly string[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts: HeatmapOpts): HeatmapSpec;
export declare const heatLevel: (v: number, s: Pick<HeatmapSpec, 'min' | 'max' | 'levels'>) => number;
export declare function heatmapAlt(s: HeatmapSpec): string;
export declare function heatmapTexts(s: HeatmapSpec): [string, number][];
export declare function layoutHeatmap(s: HeatmapSpec, g: ChartGeom): LaidOutChartPart;
