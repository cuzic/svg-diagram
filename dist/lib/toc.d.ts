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
/** What the final pick reads of a figure: its height, its score, the ranks of its layers, how many ANDs were left undrawn and how many size limits were applied. */
export interface Judged {
    h: number;
    score: readonly number[];
    layers: readonly number[];
    loose: number;
    fits: number | undefined;
}
/**
 * The final pick (ADR 0073 D1 (d)): of the first figure (with the detours), the best order with the detours and the best figure without them, in this order, the one that is in the frame of the figures
 * the search compared (the same layers by rank, no more ANDs left undrawn, the same number of size limits) and `adopts`-better than the running pick (a tie keeps the earlier). The detours may have made
 * `first` lower than any order would be without them, and may make AND arrows cross, so the figure without them stays a candidate.
 */
export declare function pickFinal<T>(first: T, candidates: readonly (T | undefined)[], base: {
    h: number;
    layers: readonly number[];
    loose: number;
    fits: number | undefined;
}, exchange: boolean, view: (t: T) => Judged): T;
/** A count of the orders the search laid out (a measure of its cost that does not depend on the load of the machine; read by the tests and by scripts/crt-u6-measure). */
export declare const searchStats: {
    laid: number;
};
/**
 * Whether an order's figure is not too tall (ADR 0073 D1 (b), (c-1), (c-2)): up to the first order's height + 0.5px always; a taller one only when it has strictly fewer crossings than the best
 * so far and is at most 1.25 times the FIRST order's height (`base`, not the best's: a taller figure taken does not raise the limit for the next one).
 */
export declare const mayBeTaller: (t: {
    h: number;
    crossings: number;
}, base: {
    h: number;
}, best: {
    crossings: number;
}) => boolean;
/**
 * The rank of each value along a layer: ascending, values within 0.5px of the next smaller one share its rank (the gaps between boxes may differ from order to order, the layers may not; ADR 0073 D1 (e)).
 * Joined by the difference, not by a rounded grid: two values 0.02px apart are one rank wherever they fall.
 */
export declare function layerRank(values: readonly number[]): number[];
/** Whether an order's figure (height `h`, its score) replaces the best one `best` (the search) or the pick (the end): not too tall, and a lexicographically smaller score (ADR 0073 D1 (b)-(d)). `exchange` false: only the figures up to the first order's height + 0.5px. */
export declare const adopts: (h: number, score: readonly number[], base: {
    h: number;
}, best: readonly number[], exchange?: boolean) => boolean;
export declare const lexLess: (a: readonly number[], b: readonly number[]) => boolean;
export declare function layoutCauseBandOnce(band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, canvasBound?: boolean, anotherOrder?: readonly string[], plainRoutes?: boolean, noDetour?: boolean): LaidOutCause;
/** The nodes a CRT moves by default (ADR 0070 D1): the preconditions, and every node whose causes (one or more, on the links as
 *  written, before any cycle is cut) all are in the set, found forwards to the least fixpoint. A node on a cycle never joins: its cause on
 *  the cycle does not join before it does. */
export declare function crtMovers(band: Pick<CauseBand, 'nodes' | 'links'>): Set<string>;
export declare function cloudTexts(band: CloudBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutCloudBand(band: CloudBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutCloud;
