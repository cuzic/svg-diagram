import {texts} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {buildTimeline} from '../dsl/timeline.ts';
import {renderTimeline} from '../emit-timeline.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {layoutTimeline, timelineTexts} from '../timeline.ts';
import type {LaidOutTimeline, NumericTimelineBand, NumericTimelineOpts, TimelineBand, TimelineOpts} from '../types/timeline.ts';
import {timelineProblems} from '../verify-timeline.ts';

const definition = {
  type: 'timeline',
  selfDimming: true,
  offGrid: true,
  textSizes: texts,
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of timelineTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles}) {
    const laid = layoutTimeline(data, x, y, w, widthOf, roles);
    return {laid, h: laid.h};
  },
  emit: (laid, {theme}) => renderTimeline(laid, theme),
  verify: {
    check: laid => timelineProblems(laid).map(message => ({rule: 'timeline', severity: 'problem', message})),
  },
} satisfies BandDef<TimelineBand | NumericTimelineBand, LaidOutTimeline>;

export function timeline<const Id extends string = never>(opts: NumericTimelineOpts & {id?: Id}): WithBandDef<NumericTimelineBand & Declares<Id> & HandleOf<Id>, LaidOutTimeline>;
export function timeline<const Id extends string = never>(opts: TimelineOpts & {id?: Id}): WithBandDef<TimelineBand & Declares<Id> & HandleOf<Id>, LaidOutTimeline>;
export function timeline(opts: TimelineOpts | NumericTimelineOpts): WithBandDef<TimelineBand | NumericTimelineBand, LaidOutTimeline> {
  return band<TimelineBand | NumericTimelineBand, LaidOutTimeline>(definition, buildTimeline(opts));
}

/** @internal Definition used by the full renderer. */
export const timelineDefinition: BandDef<TimelineBand | NumericTimelineBand, LaidOutTimeline> = definition;
