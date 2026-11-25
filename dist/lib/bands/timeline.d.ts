import type { BandDef, WithBandDef } from '../band-def.ts';
import type { Declares, HandleOf } from '../strict.ts';
import type { LaidOutTimeline, NumericTimelineBand, NumericTimelineOpts, TimelineBand, TimelineOpts } from '../types/timeline.ts';
export declare function timeline<const Id extends string = never>(opts: NumericTimelineOpts & {
    id?: Id;
}): WithBandDef<NumericTimelineBand & Declares<Id> & HandleOf<Id>, LaidOutTimeline>;
export declare function timeline<const Id extends string = never>(opts: TimelineOpts & {
    id?: Id;
}): WithBandDef<TimelineBand & Declares<Id> & HandleOf<Id>, LaidOutTimeline>;
/** @internal Definition used by the full renderer. */
export declare const timelineDefinition: BandDef<TimelineBand | NumericTimelineBand, LaidOutTimeline>;
