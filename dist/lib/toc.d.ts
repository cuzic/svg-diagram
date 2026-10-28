import type { EmphasisTone, FontFamily, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { CauseBand, CauseRole, CloudBand, LaidOutCause, LaidOutCloud } from './types/diagrams.ts';
/** The arc across the arrows of an AND: where its ends and its middle are, as distances from the arrowheads' tips. */
/** The 中核 badge (ADR 0015 D4): its height and its gap to the frame; emit-figures draws it, the layout keeps the room. */
export declare const CORE_BADGE_H = 22, CORE_BADGE_W = 44, CORE_BADGE_GAP = 2;
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
export declare function cloudTexts(band: CloudBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutCloudBand(band: CloudBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutCloud;
