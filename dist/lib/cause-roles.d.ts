import type { EmphasisTone } from './types/core.ts';
import type { CauseRole } from './types/diagrams.ts';
/** What a role looks like when the node gives no tone. `double`: the box has a second outline (the finding of the figure). */
export declare const CAUSE_ROLES: Record<CauseRole, {
    tone: EmphasisTone;
    double?: boolean;
    dashed?: boolean;
}>;
/** The 中核 badge (ADR 0015 D4): its height and its gap to the frame; emit-cause.ts draws it, the layout keeps the room. */
export declare const CORE_BADGE_H = 22, CORE_BADGE_W = 44, CORE_BADGE_GAP = 2;
/** How far inside the frame a `double` box's second outline runs (emit-cause.ts draws it): the box is that much taller at both ends, so
 *  the text keeps the same padding from the inner outline that a plain box keeps from its frame (#378). */
export declare const DOUBLE_INSET = 4;
