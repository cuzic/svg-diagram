import type { LaidOutOf } from '../band-table.ts';
import type { PlanSpan } from './adapter.ts';
/** Put lanes and steps in the same group, with a subgroup for the lanes (ADR 0054 D9.2). */
export declare const swimlaneSpan: PlanSpan<LaidOutOf<'swimlane'>>;
