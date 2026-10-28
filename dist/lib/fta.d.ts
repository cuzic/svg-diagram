import type { FontFamily, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { FtaBand, FtaEvent, FtaGate, FtaKind, LaidOutFta } from './types/diagrams.ts';
export declare const FTA_KINDS: readonly ['event', 'basic', 'undeveloped', 'house', 'condition'];
export declare const FTA_GATES: readonly ['and', 'or', 'vote', 'inhibit'];
/** An event as drawn: `ref` events are resolved to the event they repeat. */
export interface FtaNode {
    key: string;
    label: string;
    sub?: string;
    kind: FtaKind;
    /** Set on the first drawing of an event with an id (the anchor); a repeat has none. */
    id?: string;
    /** A repeat of the event with this id. */
    copyOf?: string;
    gate?: FtaGate;
    k?: number;
    state?: boolean;
    p?: number;
    children: FtaNode[];
    cond?: FtaNode;
}
/** A probability as written on an event and in the note: 2 significant digits, in exponent form below 0.001. */
export declare const fmtP: (p: number) => string;
/** The note under a tree with `quant`: the probability of the top event and what it assumes. Throws naming the events that have no `p`. */
export declare function ftaQuant(root: FtaNode, period?: string): string;
/** The ids of the events written with an `id` (not the `ref` repeats): what connect() can reach. Does not validate. */
export declare function ftaIds(top: FtaEvent): string[];
/** Validates the tree (every error throws, naming the event) and resolves the repeats. */
export declare function ftaResolve(top: FtaEvent): {
    root: FtaNode;
    nodes: FtaNode[];
};
/** The variables that alone bring the top event about. Throws when the tree has too many cut sets to find them (a tree with `cutSets: true` is never analysed by guessing). */
export declare function ftaSinglePoints(root: FtaNode): Set<string>;
export declare function ftaTexts(band: FtaBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutFta(band: FtaBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutFta;
