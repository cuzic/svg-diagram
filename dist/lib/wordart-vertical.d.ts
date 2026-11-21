import type { FontFamily, WidthOf } from './types/core.ts';
/** A column advances by this many sizes (the gap between columns is 0.4 of a size). */
export declare const COLUMN_PITCH = 1.4;
export declare const BASELINE = 0.36;
/** The characters a person sees (an emoji with its modifiers, or a joined family, is one). */
export declare const graphemes: (text: string) => string[];
/** A unit of a vertical column, before any width is known. */
export type VToken = {
    kind: 'glyph';
    ch: string;
    dx: number;
    dy: number;
    turn: boolean;
}
/** A run of 1-2 digits set upright in one cell. */
 | {
    kind: 'tcy';
    text: string;
}
/** A Latin word / number set on its side, along the column. */
 | {
    kind: 'side';
    text: string;
} | {
    kind: 'blank';
};
/** Splits one column of text (no newline) into tokens. Pure; independent of any width. */
export declare function tokenizeColumn(text: string): VToken[];
/** The size a 1-2 digit run is set at (it must fit one cell). */
export declare const tcySize: (size: number) => number;
export interface VCell {
    token: VToken; /** px from the column's top. */
    top: number; /** px along the column. */
    len: number;
}
export interface VColumn {
    cells: VCell[];
    len: number;
}
/**
 * Sets text in vertical columns (right to left on the page, so `columns[0]` is the rightmost). A newline starts a column; with `limit`
 * (px), a column that would grow past it breaks first — a character that must not start a column (、。）」ー small kana ...) stays on the
 * previous one, an opening bracket never ends one. `spacing` is added after every cell.
 */
export declare function verticalColumns(text: string, size: number, weight: number, widthOf: WidthOf, opts?: {
    limit?: number;
    spacing?: number;
    font?: FontFamily;
}): VColumn[];
