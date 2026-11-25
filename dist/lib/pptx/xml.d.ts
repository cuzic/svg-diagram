import { escapeAttr } from '../xml-escape.ts';
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface Fonts {
    sans: string;
    mono: string;
}
export declare const EMU = 9525;
export declare const emu: (px: number) => number;
export declare const hex: (c: string) => string;
export declare const xfrm: (r: Rect) => string;
export declare const solidFill: (color: string) => string;
export declare const roundRectAdj: (r: Rect) => number;
/** Escape for an attribute value (`escapeXml` leaves the quote alone). */
export declare const attr: typeof escapeAttr;
/**
 * The size of a line end in PowerPoint, which draws it as a multiple of the line's width (at least about 2.65px, 0.7 mm): about 2, 3 and 5
 * for sm, med and lg (LibreOffice's import of DrawingML follows the same rule). The one nearest the svg's head: a marker 7 widths long
 * on a line, 16px on a strong (5px) one.
 */
export declare function endSize(widthPx: number, headPx?: number): 'sm' | 'med' | 'lg';
/** The arrowheads of a line: `start` is the line's first point (`headEnd`), `end` its last (`tailEnd`), sized for a line `widthPx` wide. */
export declare function arrowEnds(arrow: 'start' | 'end' | 'both' | 'none' | undefined, widthPx: number): string;
/** The `p:sp` / `p:cxnSp` wrappers every shape of the slide shares. */
export declare const sp: (id: number, name: string, spPr: string, txBody: string) => string;
export declare const cxnSp: (id: number, name: string, glue: string | undefined, spPr: string) => string;
