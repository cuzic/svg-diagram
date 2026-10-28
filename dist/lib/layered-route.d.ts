import type { LayeredEdge, LayeredLayout, LayeredNode, LayeredOpts, Pt } from './graph-layout.ts';
import { simplify } from './polyline-metrics.ts';
export { simplify };
export declare const STUB = 18;
export declare const LANE = 14;
/** The gap two layers need so that `n` direct arrows through it each get a lane (and a label chip beside them has room). */
export declare const gapFor: (n: number, chip?: number, space?: number) => number;
/** The stub and the lane step at a scale of the gaps (`WrapEnv.space`: 1, or 0.75 for `density: 'compact'`). */
export declare const stubOf: (space?: number) => number;
export declare const laneStepOf: (space?: number) => number;
/**
 * Horizontal-vertical-horizontal elbows through the points (the layer axis is x here). A direct arrow turns at `turn` (an x in the gap
 * between its two layers, from routeLayered); the others turn half-way between their points.
 */
export declare function elbows(pts: Pt[], turn?: number, lastTurn?: number): Pt[];
/**
 * routeOnce twice: with the lanes of a gap at the fixed step, and spread over the room the gap has (`laneIn`). The spread routes are kept
 * only when (crossings, bends) is no worse: the order of the lanes is the same, but where they sit decides which runs cross.
 */
export declare function routeLayered(lay: LayeredLayout, place: (p: Pt) => Pt, portStep?: number, groupOf?: (edge: number) => number | undefined, round?: (id: string) => boolean, straighten?: boolean, laneShare?: boolean, aside?: boolean, detour?: boolean, lonePorts?: boolean, space?: number, laneHeads?: boolean): Map<number, Pt[]>;
/** The most direct arrows that pass through one gap between two layers (each needs its own lane there). */
export declare function corridorLoad(lay: LayeredLayout): number;
/**
 * layoutLayered, with the gap between layers wide enough for the arrows that share it: laid out once to see how many arrows go
 * through each gap (layers do not depend on the gap), then again with a gap that gives each its own lane.
 */
export declare function layoutWithLanes(nodes: LayeredNode[], edges: LayeredEdge[], opts: LayeredOpts & {
    start?: string[];
    back?: readonly number[];
}, chip?: number, space?: number): LayeredLayout;
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
    /** A long arrow takes the way around the boxes with the fewest bends when that is strictly better (route-search.ts). Default false. */
    detour?: boolean;
    /** Runs of arrows with no end in common that lie along each other are moved apart, once, on the chosen candidate (route-apart.ts, ADR 0016 D14). Default false. */
    apart?: boolean;
    /** false: no ADR 0016 D12/D13 pass (side-by-side runs moved aside) on the chosen candidate. Default true. */
    aside?: boolean;
    /** Returns two layers or more long run in lanes outside the figure: 'all' of them, or only the 'declared' ones (`back`). Default none (through the layers). */
    returns?: 'all' | 'declared';
}
export interface Attempt {
    lay: LayeredLayout;
    routes: Map<number, Pt[]>;
    /** Corners and crossings of the routed arrows (placed points); lower is better. */
    score: {
        crossings: number;
        bends: number;
    };
    /** The figure's width and height (transposed back when `transpose`). */
    size: {
        w: number;
        h: number;
    };
    /** Whether `size.w` is within `maxAcross` (true when none is given). */
    fits: boolean;
    loose: string[];
    /** ADR 0016 D12/D13 moved side-by-side runs aside in this candidate. */
    asided?: true;
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
