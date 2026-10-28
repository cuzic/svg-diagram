import type { PlaneAxis, PlaneOpts, PlaneTone } from './types/figures.ts';
export interface LegendEntry {
    text: string;
    tone: PlaneTone;
    shape?: 'dot' | 'ring' | 'cross';
}
export interface ScatterPoint {
    x: number;
    y: number; /** Written beside the point. */
    label?: string; /** The stratum the point belongs to: each gets its own colour and shape. */
    group?: string;
    id?: string;
}
export interface ScatterOpts extends Omit<PlaneOpts, 'x' | 'y' | 'points' | 'lines' | 'paths' | 'dims' | 'labels' | 'yDown'> {
    /** The axis names (a string), or an axis with its own range. */
    x: string | (Omit<PlaneAxis, 'max'> & {
        max?: number;
    });
    y: string | (Omit<PlaneAxis, 'max'> & {
        max?: number;
    });
    /** Draw the least-squares line and write the correlation coefficient. */
    regression?: boolean;
    /** The order of the strata (default: as they first appear in the points). Up to 4. */
    groups?: string[];
}
export declare function correlation(xs: readonly number[], ys: readonly number[]): {
    r: number;
    slope: number;
    intercept: number;
};
export declare function scatterOpts(points: readonly ScatterPoint[], opts: ScatterOpts): PlaneOpts;
export type ControlType = 'x' | 'mr' | 'xbar' | 'r' | 'p' | 'np' | 'c' | 'u';
/** A subgroup of an attribute chart: `n` inspected (or the size of the area, for u), `d` found defective (or defects). */
export interface AttributeSample {
    n: number;
    d: number;
}
export interface ControlChartOpts extends Omit<PlaneOpts, 'x' | 'y' | 'points' | 'lines' | 'paths' | 'dims' | 'labels' | 'yDown'> {
    /** The name of the horizontal axis (default 'サンプル'). */
    xLabel?: string;
    /** The name of the vertical axis (default by chart type). */
    yLabel?: string;
    /** What to write under the numbers 1..N on the axis (dates, lot names); one per sample. */
    at?: string[];
    /** Fixed limits (from an earlier stable period) instead of the ones worked out from this data. */
    limits?: {
        cl?: number;
        ucl?: number;
        lcl?: number;
    };
    /** Mark the points that break a rule: outside the limits (red cross), 7 in a row on one side of the centre line or 7 in a row rising / falling (red ring). Default true. */
    rules?: boolean;
    /** Decimal places of the limit labels (default: 3 significant digits). */
    digits?: number;
}
export interface ControlStats {
    cl: number;
    ucl: number[];
    lcl: number[];
    values: number[];
}
/** What a chart plots and where its centre and limits are, from the data. */
export declare function controlStats(type: ControlType, data: readonly (number | number[] | AttributeSample)[], fixed?: ControlChartOpts['limits']): ControlStats;
/** The indices that break a rule: [outside the limits, in a run or a trend]. */
export declare function controlSignals(s: ControlStats): {
    outside: Set<number>;
    pattern: Set<number>;
};
export declare function controlChartOpts(type: ControlType, data: readonly (number | number[] | AttributeSample)[], opts?: ControlChartOpts): PlaneOpts;
