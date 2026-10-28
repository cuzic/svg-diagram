import { valueScale } from './charts-base.ts';
import type { ChartGeom, ChartOpts, ChartTone, LaidOutChartPart } from './charts-base.ts';
export interface TornadoItem {
    label: string;
    /** The result when this input is at its low value (not necessarily the lower result). */
    low: number;
    /** The result when this input is at its high value. */
    high: number;
    id?: string;
}
export interface TornadoOpts extends ChartOpts {
    /** The result at the base case: the line the bars start from. Required. */
    base: number;
    unit?: string;
    /** Names of the two cases in the legend (default 低ケース / 高ケース). */
    lowLabel?: string;
    highLabel?: string;
    /** Name of the base line (default 基準). */
    baseLabel?: string;
    /** Keep the order given instead of the longest first. */
    sort?: boolean;
    /** Colours of the low and the high bars (default text / accent). */
    lowTone?: ChartTone;
    highTone?: ChartTone;
    /** The value axis's end points `[lo, hi]` (widened to round ticks), so that two charts can share one axis. Smaller than the data (and the base) is an error. Default: from the data. */
    domain?: readonly [number, number];
    /** false: this chart's axis is its own on purpose (chart-axis-mismatch leaves it alone). */
    axisGroup?: false;
    /** How far the plot area starts from the chart's left edge and ends from its right edge, in px (default: what the labels need), to line it up with another chart's. Less than the labels need is an error that names the minimum. */
    plotInset?: readonly [left: number, right: number];
}
export interface TornadoSpec {
    items: TornadoItem[];
    base: number;
    unit: string;
    lowLabel: string;
    highLabel: string;
    baseLabel: string;
    lowTone: ChartTone;
    highTone: ChartTone;
    domain?: [number, number];
    axisGroup?: false;
    plotInset?: [number, number];
}
/** The value axis of a tornado: from the base and every case, or the `domain`. */
export declare function tornadoScale(s: TornadoSpec): ReturnType<typeof valueScale>;
export declare function resolveTornado(items: readonly TornadoItem[], opts: TornadoOpts): TornadoSpec;
export declare function tornadoAlt(s: TornadoSpec): string;
export declare function tornadoTexts(s: TornadoSpec): [string, number][];
export declare function layoutTornado(s: TornadoSpec, g: ChartGeom): LaidOutChartPart;
