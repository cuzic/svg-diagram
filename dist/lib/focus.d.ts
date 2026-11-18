import type { EmphasisTone, Focus } from './types/core.ts';
export type { Focus };
export declare const FOCUSED: EmphasisTone, RELATED: EmphasisTone, OTHER: EmphasisTone;
/**
 * The indices of the focused items. `ids[i]` is the id of item i (undefined: it has none). Numbers (1-based positions) are taken
 * only when `numbers` is true (a sequence); anything that names no item throws, listing what can be named.
 */
export declare function resolveFocus(focus: Focus, ids: readonly (string | undefined)[], who: string, numbers?: boolean): Set<number>;
/** A graph: the focused items solid, the ones a link away accent, the rest muted. `links` are pairs of item indices (either direction). */
export declare function graphTones(n: number, links: readonly (readonly [number, number])[], focused: ReadonlySet<number>): EmphasisTone[];
/** A sequence: the focused items solid, the rest muted. */
export declare function sequenceTones(n: number, focused: ReadonlySet<number>): EmphasisTone[];
/** A link of a graph is lit when it touches a focused item. */
export declare const litLink: (a: number, b: number, focused: ReadonlySet<number>) => boolean;
