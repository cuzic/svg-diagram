export { CAUSE_ROLES, CORE_BADGE_H, CORE_BADGE_W, CORE_BADGE_GAP, DOUBLE_INSET } from './cause-roles.ts';
import { lexLess } from './layered-route.ts';
import type { FontFamily, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { CauseBand, LaidOutCause } from './types/diagrams.ts';
/** The arc across the arrows of an AND: where its ends and its middle are, as distances from the arrowheads' tips. */
/** The arc of an AND (ADR 0070 D8, a cause tree's band): its middle `peak` from the tips leaves a visible gap to the arrowhead's base of 0.4 x
 *  the text size (14 x `s`, the line half-width taken off); its ends are 6 x `s` farther; it reaches `reach` past the outer arrows.
 *  pdpc / relationDiagram / whyWhyTree keep the old arc (21 / 15 / 10). `s` is 1 until the lines scale with the canvas text (D7). */
export declare const andArc: (s?: number) => {
    end: number;
    peak: number;
    reach: number;
};
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
/**
 * ADR 0075 D3: the final pick in two stages. M = main's own pick (`first` and the candidates of the order search only). R = the best of the rows candidates alone, each checked first (frame, height against M's score, overlaps not above M's).
 * R replaces M only when the window of ADR 0073 D2 over the pair [M, R] selects R: a pairs-only gain costs at most +4 bends (D1-4), a lower C wins, a tie keeps M. So the final figure is M or R, never another candidate of the order search
 * (one `pickFinal` over all of them is not monotone: a rows candidate that is not chosen could shrink the window and move the pick to another one), and a figure differs from main's only when the window selects R.
 */
export declare function pickTwoStage<T>(first: T, main: readonly (T | undefined)[], rows: readonly (T | undefined)[], base: {
    h: number;
    layers: readonly number[];
    loose: number;
    fits: number | undefined;
}, exchange: boolean, view: (t: T) => Judged, ovOf?: (t: T) => number, onReplace?: (m: T, r: T) => void): T;
/** What the final pick reads of a figure: its height, its score, the ranks of its layers, how many ANDs were left undrawn and how many size limits were applied. */
export interface Judged {
    h: number;
    score: readonly number[];
    layers: readonly number[];
    loose: number;
    fits: number | undefined;
}
/** Whether a figure is in the frame of the figures the search compares (D1 (a), (e)): the same layers by rank, no more ANDs left undrawn, the same number of size limits applied. The search loop and the final pick both ask it. */
export declare const inFrame: (v: {
    layers: readonly number[];
    loose: number;
    fits: number | undefined;
}, base: {
    layers: readonly number[];
    loose: number;
    fits: number | undefined;
}) => boolean;
/**
 * The final pick (ADR 0073 D1 (d), D2): of the first figure (with the detours), the best order with the detours and the best figure without them, the one the selection of the list chooses (window and all).
 * A figure joins the list only when it is in the frame of the figures the search compared (the same layers by rank, no more ANDs left undrawn, the same number of size limits) and passes the height gate
 * against the pick so far (`passesHeight`). The detours may have made `first` lower than any order would be without them, and may make AND arrows cross, so the figure without them stays a candidate.
 */
export declare function pickFinal<T>(first: T, candidates: readonly (T | undefined)[], base: {
    h: number;
    layers: readonly number[];
    loose: number;
    fits: number | undefined;
}, exchange: boolean, view: (t: T) => Judged): T;
/**
 * The candidates of one stage with their scores (ADR 0073 D2). `add` keeps every score and the figure only while it is in the window (a window never takes back what it left: when C falls, the earlier
 * candidates are out; when the least bends fall, it only shrinks). `best` is the selection of the whole list. A tie keeps the earlier candidate.
 * `add` says whether the search made progress: the selection changed, or the best (C, bends, height) without the pairs got lower (a candidate that only the pairs keep from being chosen is still a better
 * figure on the keys the search waited on before the pairs were a key: the wait does not run out sooner for the pairs, which stopped a figure's search short of the order that crosses less).
 */
export declare function windowPool<T>(first: T, score: readonly number[]): {
    readonly best: {
        item: T | undefined;
        score: readonly number[];
    };
    add: (item: T, score: readonly number[]) => boolean;
    readonly size: number;
    readonly held: number;
};
/** A count of the orders the search laid out (a measure of its cost that does not depend on the load of the machine; read by the tests and by scripts/crt-u6-measure). */
export declare const searchStats: {
    laid: number;
    /** Every placement `layoutCauseBandAt` made (the cost of ADR 0075 D5: it does not depend on the load of the machine). */ layouts: number;
    /** The row searches run, the candidates laid out, the ones that won the pool, the figures a rows candidate replaced main's pick in, and the annealing moves tried. */ rowSearches: number;
    rowCandidates: number;
    rowsWon: number;
    replaced: number;
    moves: number;
};
/** For the tests (ADR 0075 U1): called with the score and the sub-4px overlaps of main's pick M and of the rows candidate R each time R replaces M. */
export declare const searchHooks: {
    onReplace?: (m: {
        score: readonly number[];
        overlaps: number;
    }, r: {
        score: readonly number[];
        overlaps: number;
    }) => void;
};
/** The lane step the band's pairs are counted at: `laneStepOf(space x scale)`, the scale being the canvas's line scale of a cause tree's own band (1 for the others). The same value `layeredAttempt` takes as its `unit`. */
export declare const bandSep: (band: CauseBand, env: WrapEnv) => number;
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
/** Whether an order's figure may join the list of candidates (ADR 0073 D1 (b)-(d)): not too tall (`mayBeTaller`; `exchange` false: only up to the first order's height + 0.5px). `score` is a `scoreOfCause` score: its crossings are the third. */
export declare const passesHeight: (h: number, score: readonly number[], base: {
    h: number;
}, best: readonly number[], exchange?: boolean) => boolean;
export { lexLess };
export declare function layoutCauseBandOnce(band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, canvasBound?: boolean, anotherOrder?: readonly string[], plainRoutes?: boolean, noDetour?: boolean): LaidOutCause;
/** The nodes a CRT moves by default (ADR 0070 D1): the preconditions, and every node whose causes (one or more, on the links as
 *  written, before any cycle is cut) all are in the set, found forwards to the least fixpoint. A node on a cycle never joins: its cause on
 *  the cycle does not join before it does. */
export declare function crtMovers(band: Pick<CauseBand, 'nodes' | 'links'>): Set<string>;
export { cloudTexts, layoutCloudBand } from './cloud.ts';
