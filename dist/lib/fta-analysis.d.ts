import type { FtaNode } from './fta.ts';
/** More sets than this at any step (counted before absorption, which is where they grow first) and the analysis stops. */
export declare const CUT_SET_LIMIT = 5000;
export interface CutSets {
    /** The minimal cut sets, each a sorted list of variables; smallest first. Empty when `truncated`. */
    sets: string[][];
    truncated: boolean;
}
/** The variable a leaf stands for: a repeat shares the variable of the event it repeats. */
/** `id:` / `k:` keep a user's id apart from the internal key (an id like 'n2' must not meet the key of another event). */
export declare const ftaVar: (n: Pick<FtaNode, 'key' | 'id' | 'copyOf'>) => string;
/** The minimal cut sets of the tree. `truncated` when a step passed CUT_SET_LIMIT (then `sets` is empty: nothing is guessed). */
export declare function minimalCutSets(root: FtaNode): CutSets;
/** The variables that alone bring the top event about (the cut sets of size 1). */
export declare function singlePoints(cuts: CutSets): Set<string>;
/** Shared variables above this are not enumerated: the answer is then the min-cut upper bound. */
export declare const SHARED_LIMIT = 12;
export interface TopProbability {
    p: number;
    /** An upper bound (the min-cut upper bound), not the exact value: too many shared events to enumerate. */
    bound: boolean;
}
/** The probability of the top event. Every leaf that is not a house event needs `p` (the caller checks, naming the events). */
export declare function topProbability(root: FtaNode): TopProbability;
