import type { TimelineBand, TimelineOpts, NumericTimelineBand, NumericTimelineOpts } from '../types/timeline.ts';
import type { Declares, HandleOf } from '../strict.ts';
/**
 * A horizontal time axis with a deadline: the axis (`from` - `to`), today (`now`), the deadline and the span between them
 * ("あと 1 年 3 か月"), plus optional marks. Dates are 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'; `now` is always written out, never read from the clock.
 */
/** A numeric axis (`unit: 'ms'`, `from: 0`, `to: 700`) with lanes, events (dots with labels) and spans (bars, or dimension lines with `dim: true`). */
export declare function timeline<const Id extends string = never>(opts: NumericTimelineOpts & {
    id?: Id;
}): NumericTimelineBand & Declares<Id> & HandleOf<Id>;
export declare function timeline<const Id extends string = never>(opts: TimelineOpts & {
    id?: Id;
}): TimelineBand & Declares<Id> & HandleOf<Id>;
export declare function buildTimeline(arg: TimelineOpts | NumericTimelineOpts): TimelineBand | NumericTimelineBand;
