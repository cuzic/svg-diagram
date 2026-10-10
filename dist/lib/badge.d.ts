import type { ColorKey } from './types.ts';
export type BadgeShape = 'circle' | 'square' | 'triangle';
export interface BadgeBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
export declare const BADGE_R = 11;
/** Width/height of a badge for a label of measured width `textW`; `r` is the base radius. */
export declare function badgeBox(cx: number, cy: number, textW: number, r?: number, shape?: BadgeShape): BadgeBox;
/** Label colour for a fill (resolved #rrggbb): white-ish `bg` or `text`, whichever contrasts more. */
export declare function badgeTextKey(fillHex: string): 'bg' | 'text';
export interface BadgeSvgOpts {
    cx: number;
    cy: number;
    shape: BadgeShape;
    r: number;
    w: number;
    label: string;
    aria: string;
    size: number;
    weight?: number;
    /** Resolved colours (#rrggbb). `text` is picked from `fill` when omitted. */
    fill: string;
    stroke?: string | null;
    sw?: number;
    text?: string;
    /** Explicit text baseline (box({step}) sits on its title's baseline); else centred on cy. */
    baseline?: number;
    snap: (n: number) => number;
    esc: (s: string) => string;
}
export declare function badgeSvg(o: BadgeSvgOpts): string;
export interface PillSvgOpts {
    /** The pill's rect, already snapped by the caller (each drawing context snaps its own way). */
    x: number;
    y: number;
    w: number;
    h: number;
    fill: string;
    stroke?: string | null;
    sw?: number;
    /** Text: its centre x, baseline, colour, size / weight, and the markup (already escaped / emoji-spanned). */
    cx: number;
    baseline: number;
    text: string;
    size: number;
    weight?: number;
    labelHtml: string;
}
export declare function pillSvg(o: PillSvgOpts): string;
export type { ColorKey };
