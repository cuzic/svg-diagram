import { escapeAttr } from '../emit-common.ts';
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
/** The arrowheads of a line: `start` is the line's first point (`headEnd`), `end` its last (`tailEnd`). */
export declare function arrowEnds(arrow: 'start' | 'end' | 'both' | 'none' | undefined, sized: boolean): string;
/** The `p:sp` / `p:cxnSp` wrappers every shape of the slide shares. */
export declare const sp: (id: number, name: string, spPr: string, txBody: string) => string;
export declare const cxnSp: (id: number, name: string, glue: string | undefined, spPr: string) => string;
