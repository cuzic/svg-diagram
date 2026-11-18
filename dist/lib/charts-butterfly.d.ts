import type { ChartGeom, ChartOpts, ChartTone, LaidOutChartPart } from './charts-base.ts';
export interface ButterflyRow {
    label: string;
    /** The value of the left group (>= 0). */
    left: number;
    /** The value of the right group (>= 0). */
    right: number;
    id?: string;
}
export interface ButterflyOpts extends ChartOpts {
    /** The names of the two groups, written over their halves. Required: the chart cannot be read without them. */
    leftLabel: string;
    rightLabel: string;
    unit?: string;
    /** Order of the rows: 'given' (default), or by the size of 'left' / 'right' (largest first). */
    sort?: 'given' | 'left' | 'right';
    /** Colours of the two sides (default text / accent). */
    leftTone?: ChartTone;
    rightTone?: ChartTone;
}
export interface ButterflySpec {
    rows: ButterflyRow[];
    leftLabel: string;
    rightLabel: string;
    unit: string;
    leftTone: ChartTone;
    rightTone: ChartTone;
}
export declare function resolveButterfly(rows: readonly ButterflyRow[], opts: ButterflyOpts): ButterflySpec;
export declare function butterflyAlt(s: ButterflySpec): string;
export declare function butterflyTexts(s: ButterflySpec): [string, number][];
export declare function layoutButterfly(s: ButterflySpec, g: ChartGeom): LaidOutChartPart;
