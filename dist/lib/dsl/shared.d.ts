import type { Band } from '../types/index.ts';
export declare function handleFor(id: string): {
    left: {
        value: string;
    };
    right: {
        value: string;
    };
    top: {
        value: string;
    };
    bottom: {
        value: string;
    };
    center: {
        value: string;
    };
    at: {
        value: (s: string, t: number) => string;
    };
};
export declare function withHandle<T extends object>(band: T, id: string | undefined): T;
export declare function withAnchors<T extends object>(band: T, ids: (string | undefined)[]): T;
export declare const scopeOpt: (opts: {
    scope?: string;
} | undefined, what: string) => {
    scope?: string;
};
export declare const revealOf: (opts: {
    reveal?: number;
    until?: number;
}) => {
    reveal?: number;
    until?: number;
};
export declare function assertNoReveal(opts: object | undefined, what: string): void;
export declare function assertBoxTone(tone: string | undefined, what: string): void;
export declare function assertOneOf(value: unknown, allowed: readonly string[], what: string): void;
export declare const ALIGNS: readonly ['left', 'center', 'right'];
export declare const TEXT_TONES: readonly ['text', 'accent', 'muted', 'danger'];
export declare const EMPHASIS_TONES: readonly ['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger'];
export declare function assertTextRole(role: string | undefined, allowed: readonly string[], what: string): void;
export declare function cloneBand<T extends object>(b: T): T;
/** Maps a band list; a container is copied only when something inside it changed. */
export declare function mapBands(bands: Band[], fn: (b: Band) => Band | undefined): Band[];
/** The ids of a tree's nodes (its own, and every descendant's). */
export type TreeIds<T> = (T extends {
    readonly id: infer I extends string;
} ? I : never) | (T extends {
    readonly children: readonly (infer C)[];
} ? TreeIds<C> : never);
export declare function assertFontSize(size: number): void;
