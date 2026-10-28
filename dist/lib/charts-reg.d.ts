import type { ChartGeom, ChartOpts, LaidOutChartPart } from './charts-base.ts';
import type { PolyFit } from './stats.ts';
export interface RegOpts extends ChartOpts {
    xLabel?: string;
    yLabel?: string;
    /** The polynomial order of the fit: 1 (a line, default), 2 or 3. */
    order?: 1 | 2 | 3;
    /** Draw the 95% confidence band of the fit (default true). */
    band?: boolean;
    /** Write the equation (a line) and R² of each fit in the legend. */
    stats?: boolean;
    /** Draw a LOWESS curve (locally weighted line, robust to outliers) instead of the polynomial: no band, no equation. For `residplot`: a LOWESS curve of the residuals over the points, to show what the fit missed. */
    lowess?: boolean;
    /** LOWESS: the share of the points each local fit uses (0 to 1, default 2/3; smaller follows the data more closely). */
    frac?: number;
    /** One label per row: each label is a group with a fit of its own (up to 4). */
    groups?: readonly string[];
    /** Widen the axes to cover at least this range [min, max] — the same range on every panel of a facet() makes their axes the same. */
    xRange?: readonly [number, number];
    yRange?: readonly [number, number];
}
export interface RegData {
    x: readonly number[];
    y: readonly number[];
    group?: readonly string[];
}
export interface RegSpec {
    xRange?: [number, number];
    yRange?: [number, number];
    resid: boolean;
    xLabel: string;
    yLabel: string;
    order: 1 | 2 | 3;
    band: boolean;
    stats: boolean;
    lowess: boolean;
    groups: {
        name: string;
        x: number[];
        y: number[];
        fit: PolyFit; /** The LOWESS curve (of the data, or of the residuals for residplot). */
        smooth?: (x: number) => number;
    }[];
}
export declare function resolveReg(who: string, resid: boolean, data: RegData, opts: RegOpts): RegSpec;
export declare function regAlt(s: RegSpec): string;
/** The axes the figure ends up with (what a facet shares between panels). */
export declare function regAxes(s: RegSpec): {
    x: [number, number];
    y: [number, number];
};
export declare function regTexts(s: RegSpec): [string, number][];
export declare function layoutReg(s: RegSpec, g: ChartGeom): LaidOutChartPart;
