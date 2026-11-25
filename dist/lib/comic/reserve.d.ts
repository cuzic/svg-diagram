import type { TemplatePart } from './template.ts';
export interface ReserveAtom {
    text: string; /** the blank's id, for a blank */
    slot?: string;
    w: number; /** belongs to the atom before it (one unit for breaking) */
    glue?: boolean;
}
export interface ReservedLine {
    atoms: ReserveAtom[];
    w: number;
}
export type WrapNote = 'orphan-line' | 'bubble-wide' | 'follower-split';
export interface Reserved {
    lines: ReservedLine[]; /** the width of the text block */
    inner: number;
    notes: WrapNote[];
}
/** The atoms of a template: a blank is one atom of `max` full-width characters (4 when it has no definition), the hiragana after it glued as `glued` says. */
export declare function templateAtoms(parts: readonly TemplatePart[], maxOf: (id: string) => number, atomWidth: (atom: string) => number): ReserveAtom[];
/** Wraps the atoms into the bubble's lines, widening the inner width when a blank and its hiragana are wider than 9 characters, and once or twice to cure an orphan last line. */
export declare function reserveAtoms(atoms: readonly ReserveAtom[]): Reserved;
export declare const reserveDialogue: (parts: readonly TemplatePart[], maxOf: (id: string) => number, atomWidth: (atom: string) => number) => Reserved;
