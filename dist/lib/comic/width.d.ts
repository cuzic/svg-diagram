import type { FontWeight, WidthOf } from '../types/core.ts';
/** One full-width character: CJK, kana, full-width forms, and the dashes and the ellipsis a Japanese font draws as a full em. */
export declare const isFullWidth: (atom: string) => boolean;
export declare const isHiragana: (atom: string) => boolean;
/** The width of one atom. The quantizer has a cliff wherever it stands; this one sits at k + 0.125. */
export declare const comicAtomWidth: (atom: string, widthOf: WidthOf, size?: number, weight?: FontWeight) => number;
