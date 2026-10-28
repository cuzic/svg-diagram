import type { ChartGeom, ChartOpts, LaidOutChartPart } from './charts-base.ts';
/** A row: its name, or its name with an id (a connect() / spotlight target for the whole row). */
export type HarveyRow = string | {
    label: string;
    id?: string;
};
export interface HarveyOpts extends ChartOpts {
    /** The name of the five steps, from empty (0) to full (4), written in the legend. Default なし / 一部 / 半分 / ほぼ / 十分. */
    levels?: readonly [string, string, string, string, string];
    /** The text in the top left corner (over the row names). */
    corner?: string;
    /** Column names to stress (their header is bold and the column is boxed). */
    highlight?: readonly string[];
}
export interface HarveySpec {
    rows: string[];
    rowIds: (string | undefined)[];
    cols: string[];
    values: (number | null)[][];
    levels: string[];
    corner: string;
    highlight: string[];
}
export declare function resolveHarvey(rowsIn: readonly HarveyRow[], cols: readonly string[], values: readonly (readonly (number | null)[])[], opts?: HarveyOpts): HarveySpec;
export declare function harveyAlt(s: HarveySpec): string;
export declare function harveyTexts(s: HarveySpec): [string, number][];
/** The path of a Harvey ball's filled part: `q` quarters, from 12 o'clock clockwise. */
export declare function harveyWedge(cx: number, cy: number, r: number, q: number): string;
export declare function layoutHarvey(s: HarveySpec, g: ChartGeom): LaidOutChartPart;
