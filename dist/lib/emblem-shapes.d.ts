import type { Rect } from './types/core.ts';
export type EmblemShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon' | 'trapezoid' | 'inverted-trapezoid' | 'parallelogram' | 'pentagon-down' | 'pill' | 'rounded' | 'document' | 'cylinder';
export declare const EMBLEM_SHAPES: readonly EmblemShape[];
type Pt = [number, number];
/** The text rectangle's width and height as fractions of D (its centre is `textCy`, below). Chosen so its corners stay inside the outline (see emblemClearance). */
export declare const EMBLEM_TEXT: Record<EmblemShape, {
    w: number;
    h: number;
}>;
/** The shapes whose height follows their text (their width is D, as for the others). */
export declare const EMBLEM_FLEX: ReadonlySet<EmblemShape>;
/** The height of a shape D wide that holds `textH` of text: the default height, or taller for a shape in EMBLEM_FLEX whose text needs more. */
export declare function emblemHeight(shape: EmblemShape, d: number, textH?: number): number;
export declare const emblemMaxHeight: (shape: EmblemShape, d: number) => number;
export interface EmblemOutline {
    h: number;
    textCy: number;
    anchor: Rect;
    /** A polygon outline, or ... */ points?: Pt[];
    /** ... an SVG path (pill / rounded / document / cylinder), or neither: a circle. */ path?: string;
    /** The bounding box of what is drawn (a path's extent, which the layout's measure of a figure needs). */ box: Rect;
}
/** `height` is the drawn height of a shape in EMBLEM_FLEX (emblemHeight); the others ignore it. */
export declare function emblemOutline(shape: EmblemShape, left: number, top: number, d: number, height?: number): EmblemOutline;
/** How far `q` is inside the outline of a shape of drawn height `height` (EMBLEM_FLEX shapes; negative: outside), measured to the nearest edge; a line inside it (a cylinder's rim) counts as an edge too. */
export declare function emblemClearance(shape: EmblemShape, left: number, top: number, d: number, q: Pt, height?: number): number;
export {};
