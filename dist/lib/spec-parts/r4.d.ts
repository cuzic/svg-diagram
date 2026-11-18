import type { PartDef } from '../spec-kit.ts';
/** Events of a fault tree, `ref`s included, and how deep it goes below the top event. */
export declare const MAX_FTA_EVENTS = 30;
export declare const MAX_FTA_DEPTH = 5;
/** Factors and arrows of a relations diagram: its layout untangles crossings like a cause tree's. */
export declare const MAX_RELATION_NODES = 20;
export declare const MAX_RELATION_LINKS = 40;
/** Variables and links of a causal loop diagram, and the loops it may hold: every simple loop is found, named and drawn. Left to right,
 *  9 variables already leave their labels no room at the figure's width. */
export declare const MAX_CAUSAL_NODES = 8;
export declare const MAX_CAUSAL_LINKS = 14;
export declare const MAX_CAUSAL_LOOPS = 8;
/** Cards of an affinity diagram, in all its groups. */
export declare const MAX_AFFINITY_CARDS = 40;
export declare const PARTS_R4: readonly PartDef[];
