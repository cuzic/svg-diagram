import type { ChartGeom, ChartOpts, LaidOutChartPart } from './charts-base.ts';
export type MultiMode = 'hist2d' | 'kde2d' | 'joint' | 'pair';
export interface MultiOpts extends ChartOpts {
    /** The axis names (hist2d / jointplot). */
    xLabel?: string;
    yLabel?: string;
    /** hist2d / jointplot: about this many classes along an axis (round class widths). */
    bins?: number;
    /** pairplot: only the lower triangle and the diagonal. */
    corner?: boolean;
    /** One label per row of the data: each label is a group (up to 4). */
    groups?: readonly string[];
}
export interface XY {
    x: readonly number[];
    y: readonly number[];
    group?: readonly string[];
}
export interface MultiSpec {
    mode: MultiMode;
    xLabel: string;
    yLabel: string;
    bins?: number;
    corner: boolean;
    ids: string[];
    /** hist2d / joint */
    x: number[];
    y: number[];
    /** pair */
    vars: {
        name: string;
        values: number[];
    }[];
    /** The group of every row (0 when there are none) and their names. */
    gi: number[];
    names: string[];
}
export declare function resolveMulti(who: string, mode: MultiMode, data: XY | Readonly<Record<string, readonly number[]>>, opts: MultiOpts): MultiSpec;
export declare function multiAlt(s: MultiSpec): string;
export declare function multiTexts(s: MultiSpec): [string, number][];
export declare function layoutMulti(s: MultiSpec, g: ChartGeom): LaidOutChartPart;
