import type { FontFamily, Roles, WidthOf } from './types/core.ts';
import type { LaidOutTimeline, NumericTimelineBand, TimelineBand } from './types/timeline.ts';
/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' -> days since the epoch (UTC; a year or month means its first day). Never reads the clock. */
export declare function timelineDay(at: string, what: string): number;
/** "あと 1 年 3 か月" / "あと 45 日"; past the deadline: "期限を 2 か月 過ぎた". Whole months by calendar, days only under a month. */
export declare function remainingText(from: string, to: string): string;
/** Ticks on the axis: a step of whole months (1, 3, 6, 12, 24, 60) that leaves at most ~8 of them; each tick is a month that is a multiple of the step. */
export declare function ticksOf(from: number, to: number): {
    day: number;
    label: string;
}[];
/** Every string a timeline draws, registered before its geometry is calculated. */
export declare function timelineTexts(band: TimelineBand | NumericTimelineBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutTimeline(band: TimelineBand | NumericTimelineBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutTimeline;
/** Tick values: `step` (or 1, 2, 5 x a power of ten with at most `max` ticks) from the first multiple of it at or after `from`. */
export declare function numericTicks(from: number, to: number, step: number | undefined, max: number): number[];
