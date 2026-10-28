import type { Rect } from './types/core.ts';
import type { LaidOutBand } from './types/index.ts';
import type { FindingData } from './types/verdicts.ts';
export type LayoutRule = 'layout-sibling-size' | 'layout-edge-misalign' | 'layout-gutter-uneven' | 'layout-unused-space' | 'layout-figure-offset' | 'layout-figure-narrow' | 'layout-align-mixed';
/** One measured finding: the rule, a human message, and the numbers a machine reads (`--format json`). */
export interface LayoutMetric {
    rule: LayoutRule;
    message: string;
    data: FindingData;
}
/** Sibling widths / edges that differ by 1..GRID px are one grid step off: the drawn result of rounding, not a design (0 = aligned; more = a different thing). */
export declare const GRID = 4;
/** Gaps between neighbours in a row that differ by this much or more look uneven (edges are on the 4px grid, so this means any difference: the layout keeps equal gutters). */
export declare const GUTTER_UNEVEN_PX = 2;
/** Free room under a frame's content: two text lines (2 x 24px) and 40% of the frame. */
export declare const UNUSED_MIN_PX = 48;
export declare const UNUSED_MIN_RATIO = 0.4;
/** Left and right margins of the whole figure that differ by this much or more (the figure sits to one side). */
export declare const FIGURE_OFFSET_PX = 48;
/** The content is narrower than this share of the figure width. */
export declare const FIGURE_NARROW_RATIO = 0.5;
/** Everything the figure shows, as one rect (labels of shapes included). Captions (titles and the source line), the status strip and legends are furniture, not the figure. */
export declare function contentBox(laidOut: LaidOutBand[], tight?: boolean): Rect | null;
/** Every layout metric finding of a laid-out diagram. `width` is the figure width; `slideCanvas` skips the whole-figure rules (the canvas is fixed). */
export declare function layoutMetrics(laidOut: LaidOutBand[], opts: {
    width: number;
    slideCanvas?: boolean;
}): LayoutMetric[];
