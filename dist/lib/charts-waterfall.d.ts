import { valueScale } from './charts-base.ts';
import type { ChartGeom, ChartOpts, ChartTone, LaidOutChartPart } from './charts-base.ts';
export type WaterfallKind = 'start' | 'delta' | 'subtotal' | 'total';
export interface WaterfallStep {
    label: string;
    /** The change (a delta), or the level (start); a subtotal / total may leave it out (the running level is then used) or give it to be checked against the running level. */
    value?: number;
    /** Default: the first step is the 'start', every other a 'delta'. */
    kind?: WaterfallKind;
    /** A spotlight / connect() anchor. */
    id?: string;
    /** Overrides the colour of the bar (default: start / total dark, subtotal muted, increase accent, decrease danger). */
    tone?: ChartTone;
}
export interface WaterfallOpts extends ChartOpts {
    /** Written after every value ('万円', '%'). */
    unit?: string;
    /** Draw the value axis with its ticks (default true). */
    axis?: boolean;
    /** Connectors between the bars (default true). */
    connectors?: boolean;
    /** 'v' (default): the steps left to right, the bars rise and fall. 'h': the steps top to bottom, the bars run right and left (long labels). */
    dir?: 'v' | 'h';
    /** The value axis's end points `[lo, hi]` (widened to round ticks), so that two charts can share one axis: the bars of the same size then have the same length. Smaller than the data is an error. Default: from the data. */
    domain?: readonly [number, number];
    /** false: this chart's axis is its own on purpose (chart-axis-mismatch leaves it alone). */
    axisGroup?: false;
    /** `dir: 'h'` only: how far the plot area starts from the chart's left edge and ends from its right edge, in px (default: what the labels need). Charts written with the same `plotInset` and the same `domain` draw the same value as the same length. Less than the labels need is an error that names the minimum. */
    plotInset?: readonly [left: number, right: number];
}
export interface ResolvedStep {
    label: string;
    kind: WaterfallKind;
    value: number;
    from: number;
    to: number;
    id?: string;
    tone?: ChartTone;
}
export interface WaterfallSpec {
    steps: ResolvedStep[];
    unit: string;
    axis: boolean;
    connectors: boolean;
    dir: 'v' | 'h';
    domain?: [number, number];
    axisGroup?: false;
    plotInset?: [number, number];
}
/** Works the running level out of the steps (and checks every subtotal / total given against it). */
export declare function resolveWaterfall(steps: readonly WaterfallStep[], opts: WaterfallOpts): WaterfallSpec;
export declare const KIND_JA: Record<WaterfallKind, string>;
export declare function waterfallAlt(spec: WaterfallSpec): string;
/** The value axis a waterfall is drawn with: from its levels (and 0), or its `domain`. The one place the layout, the description and the axis check all read. */
export declare const waterfallScale: (spec: WaterfallSpec) => ReturnType<typeof valueScale>;
export declare function waterfallTexts(spec: WaterfallSpec): [string, number][];
export declare function layoutWaterfall(spec: WaterfallSpec, g: ChartGeom): LaidOutChartPart;
