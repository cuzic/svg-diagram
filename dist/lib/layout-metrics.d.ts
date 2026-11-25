import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
import type { Finding, FindingData, Issue } from './types/verdicts.ts';
export { contentBox } from './layout-fit-width.ts';
export { FIGURE_NARROW_RATIO, FIGURE_OFFSET_PX } from './figure-metrics.ts';
export type LayoutRule = 'layout-sibling-size' | 'layout-edge-misalign' | 'layout-gutter-uneven' | 'layout-unused-space' | 'layout-figure-offset' | 'layout-figure-narrow' | 'layout-align-mixed';
/** One measured finding: the rule, a human message, and the numbers a machine reads (`--format json`). */
export interface LayoutMetric extends Issue {
    rule: LayoutRule;
    data: FindingData;
}
/** Sibling widths / edges that differ by 1..GRID px are one grid step off: the drawn result of rounding, not a design (0 = aligned; more = a different thing). */
export declare const GRID = 4;
/** Gaps between neighbours in a row that differ by this much or more look uneven (edges are on the 4px grid, so this means any difference: the layout keeps equal gutters). */
export declare const GUTTER_UNEVEN_PX = 2;
/** Free room under a frame's content: two text lines (2 x 24px) and 40% of the frame. */
export declare const UNUSED_MIN_PX = 48;
export declare const UNUSED_MIN_RATIO = 0.4;
/** Every layout metric finding of a laid-out diagram. */
export declare function layoutMetrics(laidOut: LaidOutBand[], opts: {
    width: number;
    slideCanvas?: boolean;
}): LayoutMetric[];
/** Frame measurements span bands and should run once even when several bands register them. */
export declare function frameLayoutFindings({ laidOut, layoutCheck }: LaidOutDiagram): Finding[];
