import type { WrapMode, WrapOptions } from './types/core.ts';
export type { WrapMode } from './types/core.ts';
/** The widest unit a text can be broken into under `mode` (at least one atom), for sizing a box that should not split a word; 0 for an empty text. */
export declare function longestUnitWidth(atoms: string[], atomWidth: (atom: string) => number, mode: WrapMode): number;
export declare function wrapStyledAtoms<A extends {
    text: string;
    glue?: boolean;
}>(atoms: A[], { maxWidth, atomWidth, mode }: {
    maxWidth: number;
    atomWidth: (atom: A) => number;
    mode: WrapMode;
}): A[][];
export declare function wrapAtoms(atoms: string[], { maxWidth, atomWidth, mode }: WrapOptions): string[];
export declare function wrapText(text: string, opts: WrapOptions): string[];
