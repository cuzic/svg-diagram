import type { ChartGeom, ChartOpts, ChartTone, LaidOutChartPart } from './charts-base.ts';
export interface BubblePoint {
    label: string;
    x: number;
    y: number;
    /** The measure the area stands for (> 0). */
    size: number;
    tone?: ChartTone;
    id?: string;
}
export interface BubbleAxis {
    title?: string;
    unit?: string;
    min?: number;
    max?: number; /** A dashed reference line (a threshold: growth 10%, share 1.0). */
    line?: number;
    lineLabel?: string;
}
export interface BubbleOpts extends ChartOpts {
    x?: BubbleAxis;
    y?: BubbleAxis;
    /** What the area stands for ('売上') and its unit ('億円'): the legend reads "円の面積 = 売上". */
    sizeTitle?: string;
    sizeUnit?: string;
}
export interface BubbleSpec {
    points: BubblePoint[];
    x: BubbleAxis;
    y: BubbleAxis;
    sizeTitle: string;
    sizeUnit: string;
}
export declare function resolveBubble(points: readonly BubblePoint[], opts?: BubbleOpts): BubbleSpec;
export declare function bubbleAlt(s: BubbleSpec): string;
export declare function bubbleTexts(s: BubbleSpec): [string, number][];
/** A round value for the legend circle: 1, 2 or 5 × a power of ten, at most `v`. */
export declare function roundBelow(v: number): number;
export declare function layoutBubble(s: BubbleSpec, g: ChartGeom): LaidOutChartPart;
