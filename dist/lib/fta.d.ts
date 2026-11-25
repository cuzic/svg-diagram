import type { FontFamily, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { FtaBand, FtaEvent, FtaWords, LaidOutFta } from './types/diagrams.ts';
import type { FtaNode } from './fta-resolve.ts';
export { FTA_KINDS, FTA_GATES, ftaResolve } from './fta-resolve.ts';
export type { FtaNode } from './fta-resolve.ts';
/** A probability as written on an event and in the note: 2 significant digits, in exponent form below 0.001. */
export declare const fmtP: (p: number) => string;
/** The note under a tree with `quant`: the probability of the top event and what it assumes. Throws naming the events that have no `p`. */
export declare function ftaQuant(root: FtaNode, period?: string, words?: FtaWords): string;
/** The ids of the events written with an `id` (not the `ref` repeats): what connect() can reach. Does not validate. */
export declare function ftaIds(top: FtaEvent): string[];
/** The variables that alone bring the top event about. Throws when the tree has too many cut sets to find them (a tree with `cutSets: true` is never analysed by guessing). */
export declare function ftaSinglePoints(root: FtaNode): Set<string>;
export declare function ftaTexts(band: FtaBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutFta(band: FtaBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutFta;
