import { valueScale } from './charts-base.ts';
import type { ChartGeom, ChartOpts, LaidOutChartPart } from './charts-base.ts';
export interface StackPart {
    label: string;
    value: number;
}
export interface StackColumn {
    label: string;
    parts: StackPart[];
    id?: string;
}
export interface StackedOpts extends ChartOpts {
    unit?: string;
    /** 100% columns (each column's parts as shares of its total). */
    percent?: boolean;
    /** The value axis's end points `[lo, hi]` of the stacked (not percent / mekko) columns, widened to round ticks, so that two charts can share one axis. Smaller than the data is an error. Default: from the data. */
    domain?: readonly [number, number];
    /** false: this chart's axis is its own on purpose (chart-axis-mismatch leaves it alone). */
    axisGroup?: false;
}
export type StackMode = 'stacked' | 'percent' | 'mekko';
export interface StackedSpec {
    mode: StackMode;
    series: string[];
    columns: {
        label: string;
        values: number[];
        total: number;
        id?: string;
    }[];
    unit: string;
    domain?: [number, number];
    axisGroup?: false;
}
export declare function resolveStacked(who: string, columns: readonly StackColumn[], mode: StackMode, opts: StackedOpts): StackedSpec;
/** The value axis of stacked columns (undefined for percent / mekko): from the largest column total, or the `domain`. */
export declare const stackedScale: (s: StackedSpec) => ReturnType<typeof valueScale> | undefined;
export declare function stackedAlt(s: StackedSpec): string;
export declare function stackedTexts(s: StackedSpec): [string, number][];
export declare function layoutStacked(s: StackedSpec, g: ChartGeom): LaidOutChartPart;
