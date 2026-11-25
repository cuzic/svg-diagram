import type { FtaEvent, FtaGate, FtaKind } from './types/diagrams.ts';
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
/** Validates the tree (every error throws, naming the event) and resolves the repeats. */
export declare function ftaResolve(top: FtaEvent): {
    root: FtaNode;
    nodes: FtaNode[];
};
