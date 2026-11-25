import type { LayoutMetric } from './layout-metrics.ts';
import type { Rect } from './types/core.ts';
import type { LaidOutBand } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
/** Left and right margins of the whole figure that differ by this much or more (the figure sits to one side). */
export declare const FIGURE_OFFSET_PX = 48;
/** The content is narrower than this share of the figure width. */
export declare const FIGURE_NARROW_RATIO = 0.5;
/** The rect a band covers, when it has one (a grid has no h of its own: its children carry it). */
export declare function extentOf(b: LaidOutBand): Rect | null;
export declare function basicExtentOf(b: LaidOutBand): Rect | null;
export declare function unionOf(rs: Rect[]): Rect | null;
/** Bounding box of figure content, excluding titles, source lines, status and legends. */
export declare function contentExtent(laidOut: LaidOutBand[], extent?: (band: LaidOutBand) => Rect | null): Rect | null;
/** Measure whole-figure spacing for layouts without a fixed slide canvas. */
export declare function figureLayoutMetrics(laidOut: LaidOutBand[], width: number): LayoutMetric[];
export declare function figureMetricsForExtent(box: Rect | null, width: number): LayoutMetric[];
/** A layout metric as a finding, keeping the key order rule, severity, message, data. */
export declare function layoutFinding({ rule, message, data, ...location }: LayoutMetric, layoutCheck?: 'info' | 'strict'): Finding;
