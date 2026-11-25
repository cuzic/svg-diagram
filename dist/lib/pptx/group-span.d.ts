import type { LaidOutOf } from '../band-table.ts';
import type { PlanSpan } from './adapter.ts';
/** Keep a group frame, title and its contained bands together (ADR 0054 D5). */
export declare const groupSpan: PlanSpan<LaidOutOf<'group'>>;
export { groupPptx } from './group-band.ts';
