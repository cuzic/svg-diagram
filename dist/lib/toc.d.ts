import type { EmphasisTone, FontFamily, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { CauseBand, CauseRole, CloudBand, LaidOutCause, LaidOutCloud } from './types/diagrams.ts';
/** The arc across the arrows of an AND: where its ends and its middle are, as distances from the arrowheads' tips. */
/** The 中核 badge (ADR 0015 D4): its height and its gap to the frame; emit-figures draws it, the layout keeps the room. */
export declare const CORE_BADGE_H = 22, CORE_BADGE_W = 44, CORE_BADGE_GAP = 2;
/** How far inside the frame a `double` box's second outline runs (emit-figures draws it): the box is that much taller at both ends, so
 *  the text keeps the same padding from the inner outline that a plain box keeps from its frame (#378). */
export declare const DOUBLE_INSET = 4;
/** The arc of an AND (ADR 0070 D8, a cause tree's band): its middle `peak` from the tips leaves a visible gap to the arrowhead's base of 0.4 x
 *  the text size (14 x `s`, the line half-width taken off); its ends are 6 x `s` farther; it reaches `reach` past the outer arrows.
 *  pdpc / relationDiagram / whyWhyTree keep the old arc (21 / 15 / 10). `s` is 1 until the lines scale with the canvas text (D7). */
export declare const andArc: (s?: number) => {
    end: number;
    peak: number;
    reach: number;
};
/** What a role looks like when the node gives no tone. `double`: the box has a second outline (the finding of the figure). */
export declare const CAUSE_ROLES: Record<CauseRole, {
    tone: EmphasisTone;
    double?: boolean;
    dashed?: boolean;
}>;
export declare function causeTexts(band: CauseBand, roles: Roles): [string, number, number, FontFamily][];
/** The ids a link's `from` names, as a list. */
export declare const causesOf: (l: {
    from: string | readonly string[];
}) => string[];
/**
 * A cause tree. When the arrows into an effect with an AND cross each other, or any two arrows cross, the order the entities are written in is tried again
 * in a few fixed ways (ADR 0019 D4); a figure with no crossing is never touched. Only a cause tree (not pdpc() / relationDiagram()).
 */
export declare function layoutCauseBand(band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, canvasBound?: boolean): LaidOutCause;
export declare function layoutCauseBandOnce(band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, canvasBound?: boolean, anotherOrder?: readonly string[], plainRoutes?: boolean, noDetour?: boolean): LaidOutCause;
/** The nodes a CRT moves by default (ADR 0070 D1): the preconditions, and every node whose causes (one or more, on the links as
 *  written, before any cycle is cut) all are in the set, found forwards to the least fixpoint. A node on a cycle never joins: its cause on
 *  the cycle does not join before it does. */
export declare function crtMovers(band: Pick<CauseBand, 'nodes' | 'links'>): Set<string>;
export declare function cloudTexts(band: CloudBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutCloudBand(band: CloudBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutCloud;
