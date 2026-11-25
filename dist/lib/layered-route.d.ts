import type { LayeredEdge, LayeredLayout, LayeredNode, LayeredOpts, Pt } from './graph-layout.ts';
import { simplify } from './polyline-metrics.ts';
export { simplify };
export declare const STUB = 18;
export declare const LANE = 14;
/** The gap two layers need so that `n` direct arrows through it each get a lane (and a label chip beside them has room). */
export declare const gapFor: (n: number, chip?: number, space?: number, scale?: number) => number;
/** The stub and the lane step at a scale of the gaps (`WrapEnv.space`: 1, or 0.75 for `density: 'compact'`). */
export declare const stubOf: (space?: number) => number;
export declare const laneStepOf: (space?: number) => number;
/**
 * Horizontal-vertical-horizontal elbows through the points (the layer axis is x here). `turns[k]` is the x where the run from point k to
 * point k + 1 turns (a direct arrow's lane, a long arrow's last turn or its track in a gap, from routeLayered); a run with none turns
 * half-way between its points.
 */
export declare function elbows(pts: Pt[], turns?: readonly (number | undefined)[]): Pt[];
/** A turn across a gap, by the across positions of its two runs along the layers: the one on the gap's left side and the one on its right. */
export interface Legs {
    left: number;
    right: number;
}
/**
 * ADR 0070 D4 (U4b): the order of the turns across one gap (left to right along the layers) that crosses none of them where that can be
 * done. A turn's run along the layers on the gap's left side reaches its track from the left: when it lies within the span of another
 * turn's run across the gap (or under `sep` from it), that other turn must take a track to its right, else its run across crosses it (or
 * the two runs along the layers lie side by side, under `sep` apart).
 * Likewise a run on the right side asks the other turn to take a track to its left. These are the vertical constraints of channel routing;
 * fan-in, fan-out and gaps with arrows into different heads all follow from them. A pair that asks both ways crosses whichever way it
 * goes (no constraint is added for it; other constraints may still put it in either order), and so does a pair whose constraint would close a cycle (the constraints are taken in `rank`'s order
 * of their pairs, and one that closes a cycle is left out). The rest goes by `rank` (the order as it was).
 */
export declare function constrainedOrder<T>(items: readonly T[], legsOf: (t: T) => Legs, rank: (t: T) => number, sep?: number, memo?: Map<string, number[]>): T[];
/**
 * ADR 0073 D3 rule 6: whether a moved tail is kept. (i) (crossings, bends) strictly better; (ii) the new straight line is not along another arrow's run (`along`); (iii) no pair of runs added
 * when no crossing went away (`gains`); (iv) the AND's own arrows do not cross more (`groupGrowth`, the crossings among them after minus before). The checks after (i) are asked only when it holds.
 */
export declare function tailMoveKept(before: {
    crossings: number;
    bends: number;
}, after: {
    crossings: number;
    bends: number;
}, along: () => boolean, gains: () => boolean, groupGrowth: () => number): boolean;
/** Room before the heads (ADR 0070 D3・D8; a cause tree's band only, the others leave it empty and keep the old values). */
export interface HeadRoom {
    /** The shortest last run into a head (direct arrows, the returns' last turn, D13's candidates). Default 22. */
    headRun?: number;
    /** How far before the head a long arrow makes its last turn (`lastTurn`), and the last run of a route found around the boxes (`detour`'s `tail`). Default 26. */
    turnRun?: number;
    /** The ports next to an AND group (between two groups, or a group and another arrow) are two steps apart; the rest keep one step. Default false. */
    andPorts?: boolean;
    /** ADR 0073 D3: the tail of an arrow into an AND's head is moved onto its head's height. Only where `andPorts` is (a cause tree's own band); false switches it off (the order search judges without it). Default true. */
    tailAlign?: boolean;
    /** Tests only: the bits of the hash a gap's stage is remembered by (0: every stage has the same key), to check that a collision plays back nothing. */
    stageHashBits?: number;
}
/**
 * routeOnce twice: with the lanes of a gap at the fixed step, and spread over the room the gap has (`laneIn`). The spread routes are kept
 * only when (crossings, bends) is no worse: the order of the lanes is the same, but where they sit decides which runs cross.
 */
export declare function routeLayered(lay: LayeredLayout, place: (p: Pt) => Pt, portStep?: number, groupOf?: (edge: number) => number | undefined, round?: (id: string) => boolean, straighten?: boolean, laneShare?: boolean, aside?: boolean, detour?: boolean, lonePorts?: boolean, space?: number, laneHeads?: boolean, heads?: HeadRoom, tracks?: boolean, scale?: number): Map<number, Pt[]>;
/**
 * The most direct arrows that pass through one gap between two layers (each needs its own lane there). The gaps are not sized by `trackLoad`: it depends on the order of the
 * boxes in a layer (which long arrows' turns overlap), so with it the layer coordinates differ from order to order and the order search (toc.ts, "the same layers") drops
 * its candidates (ADR 0070 U4c, review of PR #398).
 */
export declare function corridorLoad(lay: LayeredLayout): number;
/**
 * layoutLayered, with the gap between layers wide enough for the arrows that share it: laid out once to see how many arrows go
 * through each gap (layers do not depend on the gap), then again with a gap that gives each its own lane.
 */
export declare function layoutWithLanes(nodes: LayeredNode[], edges: LayeredEdge[], opts: LayeredOpts & {
    start?: string[];
    back?: readonly number[];
}, chip?: number, space?: number, scale?: number): LayeredLayout;
/** What the callers of layeredAttempt decide: how a point of the layout's own axes lands in the figure, and what counts as a width. */
export interface AttemptOpts {
    /** The step between arrows that meet one side of a box (routeLayered's `portStep`). */
    portStep?: number;
    /** The group of an input edge (by its index in `edges`): the arrows of one group (an AND) get one corridor (routeLayered's `groupOf`). */
    groupOf?: (edge: number) => number | undefined;
    /** The figure is the layout transposed (a vertical one): `size` swaps width and height. */
    transpose?: boolean;
    /** The widest the figure may be; `fits` says whether it is. Nothing is thrown here: the caller decides what a miss means. */
    maxAcross?: number;
    /** Moves a point of the layout's own axes into the figure; it may depend on the figure's size, hence a function of it. */
    place: (size: {
        w: number;
        h: number;
    }) => (p: Pt) => Pt;
    /** The nodes that are not rectangles (circles, hexagons): an arrow to or from one is never straightened off the middle of its side (routeLayered's `round`). */
    round?: (id: string) => boolean;
    /** Ids of the ANDs (or other groups) the routes leave undrawable. */
    looseOf?: (routes: Map<number, Pt[]>, lay: LayeredLayout) => string[];
    /** false: the plain layout only, no second candidate (the way back to the old figure). Default true. */
    straighten?: boolean;
    /** The second candidate also pulls source nodes toward their targets (graph-layout.ts `tighten`). Default false: a cause tree reads its causes at the first layer. */
    tighten?: boolean;
    /** The scale of the gaps (`WrapEnv.space`): the stub and the lane step of the arrows shrink with it. Default 1. */
    space?: number;
    /** ADR 0070 D7: the scale of the lines (stub, lane step, ports' room, the jogs of the later moves) of a cause tree's own band on a canvas: `max(1, the canvas's font scale)`.
     *  Kept apart from `space`; routing works out `unit = space x scale`. Default 1. */
    scale?: number;
    /** A long arrow takes the way around the boxes with the fewest bends when that is strictly better (route-search.ts). Default false. */
    detour?: boolean;
    /** Runs of arrows with no end in common that lie along each other are moved apart, once, on the chosen candidate (route-apart.ts, ADR 0016 D14). Default false. */
    apart?: boolean;
    /** false: no ADR 0016 D12/D13 pass (side-by-side runs moved aside) on the chosen candidate. Default true. */
    aside?: boolean;
    /** Returns two layers or more long run in lanes outside the figure: 'all' of them, or only the 'declared' ones (`back`). Default none (through the layers). */
    returns?: 'all' | 'declared';
    /** Room before the heads and the ports next to an AND (routeLayered's `heads`, ADR 0070 D3・D8). Default: the old 22 / 26, even ports. */
    heads?: HeadRoom;
    /** ADR 0070 D4 (U4a): each turn of a long arrow across a gap gets a track of its own (routeLayered's `tracks`; a cause tree's own band only). Default false: half-way across the gap. */
    tracks?: boolean;
    /** ADR 0073 D1-2: the figure's height (`Attempt.size.h`, rounded) is the last key when two attempts are compared. A cause tree's own band only. */
    heightKey?: boolean;
    /** ADR 0073 D2: the run pairs under one lane step of the figure's lines (`laneStepOf(space x scale)`) are a key of `better()` (crossings, pairs, bends, height), with the window of D1-4 on the bends. A cause tree's own band only. */
    pairsKey?: boolean;
}
export interface Attempt {
    lay: LayeredLayout;
    routes: Map<number, Pt[]>;
    /** Corners and crossings of the routed arrows (placed points); lower is better. */
    score: {
        crossings: number;
        bends: number; /** run pairs at the lane step (`pairsKey` only) */
        pairs?: number;
    };
    /** The figure's width and height (transposed back when `transpose`). */
    size: {
        w: number;
        h: number;
    };
    /** Whether `size.w` is within `maxAcross` (true when none is given). */
    fits: boolean;
    loose: string[];
}
/**
 * One layered layout with its routes, score, size and undrawable groups: the unit the callers (causeTree, stateDiagram, classDiagram,
 * the semantic networks) build a figure from. Two candidates are laid out: the plain one (centre each layer, relax toward the
 * neighbours) and a straightened one (Brandes-Köpf coordinates, crossing-minimal order, optionally tightened layers). The straightened one
 * is dropped when it leaves an AND undrawable that the plain one drew, runs an arrow through a box the plain one did not, or does
 * not fit a width the plain one fits. Of what is left it replaces the plain one only if (crossings, bends) is strictly better in the
 * lexicographic order, or if the plain one does not fit the width and it does. Nothing else moves a figure.
 */
export declare function layeredAttempt(nodes: LayeredNode[], edges: LayeredEdge[], layoutOpts: LayeredOpts & {
    start?: string[];
    back?: readonly number[];
}, o: AttemptOpts): Attempt;
/**
 * The key of an attempt for the selection (ADR 0073 D2): [crossings, pairs, bends, height]. The pairs are 0 without `pairsKey`, the height (`size.h`, rounded) is 0 without `heightKey` (ADR 0073 D1-2).
 * C, the part the window is measured on, is the crossings alone: `better()` has no AND key of its own (`apartOf` and `aside` guard the AND crossings apart).
 */
export declare const attemptKey: (a: Attempt, heightKey: boolean | undefined) => number[];
/**
 * `b` is worse than `a` (ADR 0073 D2; `worse` of `layeredAttempt`, which `aside`, `sharing` and `apartOf` use): more ANDs left undrawn, does not fit where `a` does, `a` is better by the selection of the two
 * (pairs and the window of the bends included), or more arrows through a box. `piercingsOf` counts the arrows through a box of an attempt.
 */
export declare const worseThan: (a: Attempt, b: Attempt, piercingsOf: (x: Attempt) => number, heightKey?: boolean) => boolean;
/**
 * The side a return's lane goes to (ADR 0073 D2): `far` and the sides that passed the size checks are one list that `selectAttempt` chooses from; a side joins it only when it is no worse than the pick so far
 * (`worse`). Of the three (far, near, low) the choice is the same in whatever order the sides come.
 */
export declare function selectSides(far: Attempt, sides: readonly Attempt[], worse: (a: Attempt, b: Attempt) => boolean, heightKey?: boolean): Attempt;
/** ADR 0016 D12/D13 (`aside`): the move is kept out when it does not take a side-by-side AND run away, or is worse (pairs included, `worse`), or crosses the AND's arrows more. */
export declare const rejectsAside: (a: Attempt, b: Attempt, c: {
    before: number;
    parallels: (x: Attempt) => number;
    andCrossings: (x: Attempt) => number;
    worse: (a: Attempt, b: Attempt) => boolean;
}) => boolean;
/** ADR 0016 D11 (`sharing`): the lanes' sharing is kept out when it does not take a side-by-side AND run away, or is worse (`worse`, pairs included). */
export declare const rejectsSharing: (a: Attempt, b: Attempt, c: {
    before: number;
    parallels: (x: Attempt) => number;
    worse: (a: Attempt, b: Attempt) => boolean;
}) => boolean;
/** ADR 0016 D14 (`apartOf`): the runs moved apart are kept out when worse (`worse`, pairs included), or, for a figure with ANDs, when they cross the AND's arrows more or run side by side more. */
export declare const rejectsApart: (a: Attempt, b: Attempt, c: {
    grouped: boolean;
    parallels: (x: Attempt) => number;
    andCrossings: (x: Attempt) => number;
    worse: (a: Attempt, b: Attempt) => boolean;
}) => boolean;
/** How many more bends than the least (among the figures with the least C) a figure may have and still be chosen for having fewer pairs (ADR 0073 D1-4: +4). */
export declare const BEND_WINDOW = 4;
/** `a` before `b` in lexicographic order. */
export declare const lexLess: (a: readonly number[], b: readonly number[]) => boolean;
/**
 * The window of a list of candidates (ADR 0073 D2, the whole-list selection): each key ends with (pairs, bends, height), what comes before is C. The window is the candidates with the least C
 * (lexicographic) whose bends are at most the least bends (b*) among those + 4. Returns their indexes, in list order. A fold of two-way comparisons that had this window would be no order at all
 * (it is not transitive: pairs 0 / bends 9, pairs 1 / bends 5, pairs 2 / bends 1 go round), so every stage chooses from its whole list.
 */
export declare function windowOf(keys: readonly (readonly number[])[]): number[];
/** The index of the chosen candidate: of the window, the least (pairs, bends, height); the first of equals. -1 for an empty list. Independent of the order of the list (up to equal keys). */
export declare function selectIndex(keys: readonly (readonly number[])[]): number;
/** The attempt chosen from a list (ADR 0073 D2): `pick0` and the lanes' sides call it once on their list. */
export declare const selectAttempt: (list: readonly Attempt[], heightKey?: boolean) => Attempt;
