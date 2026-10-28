import type { ChartGeom, ChartOpts, LaidOutChartPart } from './charts-base.ts';
export type DistKind = 'hist' | 'kde' | 'ecdf' | 'rug';
export declare const DIST_FN: Record<DistKind, string>;
export interface DistGroup {
    label: string;
    values: readonly number[];
    id?: string;
}
export type DistStat = 'count' | 'density' | 'probability' | 'percent';
export interface DistOpts extends ChartOpts {
    /** The layers drawn in this order (the function's own by default). `['hist', 'kde']` lays the curve over the bars; `rug` goes with any. */
    kind?: DistKind | readonly DistKind[];
    /** The name of the value axis. */
    label?: string;
    unit?: string;
    /** What the bars (and the curve over them) measure: counts (default for a histogram alone), a density (default with a curve), a share of the group, or its percentage. */
    stat?: DistStat;
    /** Histogram: about this many bins (round class widths), or exactly this class width (`binWidth`). The groups share their bins. */
    bins?: number;
    binWidth?: number;
    /** Histogram: filled bars (default) or only their outline, as one step line (clearer when groups overlap). */
    element?: 'bars' | 'step';
    /** KDE: the bandwidth, as a multiple of Scott's (default 1; smaller follows the data more closely). */
    bw?: number;
    /** Widen the axes to cover at least this range [min, max] — the same range on every panel of a facet() makes their axes the same. */
    xRange?: readonly [number, number];
    yRange?: readonly [number, number];
}
export interface DistSpec {
    groups: {
        label: string;
        id?: string;
        values: number[];
    }[];
    kinds: DistKind[];
    label: string;
    unit: string;
    stat: DistStat;
    element: 'bars' | 'step';
    bw: number;
    bins?: number;
    binWidth?: number;
    xRange?: [number, number];
    yRange?: [number, number];
    /** The shared classes of the histogram. */
    edges?: number[];
}
export declare function resolveDist(who: string, data: readonly number[] | readonly DistGroup[] | Readonly<Record<string, readonly number[]>>, opts: DistOpts, defaultKind: DistKind): DistSpec;
export declare function distAlt(s: DistSpec): string;
/** The axes the figure ends up with (what a facet shares between panels). */
export declare function distAxes(s: DistSpec): {
    x: [number, number];
    y: [number, number];
};
export declare function distTexts(s: DistSpec): [string, number][];
export declare function layoutDist(s: DistSpec, g: ChartGeom): LaidOutChartPart;
