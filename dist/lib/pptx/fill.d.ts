import type { PathStep } from './line-shapes.ts';
import type { Pt } from './geom.ts';
import { type Paint, type TextLine } from './prims.ts';
import type { Fonts, Rect } from './xml.ts';
import { type Geo } from './parts-group.ts';
/** A shape that may take texts: its box, and whether a point is inside its outline. */
export interface Holder {
    rect: Rect;
    hit: (p: Pt) => boolean;
    texts: TextLine[];
}
/** A line of text, and its width (px) when the layout measured it; `part`: the part it is grouped in (ADR 0054). */
export interface Placed {
    t: TextLine;
    w?: number;
    part?: string;
}
/** The width a line takes, estimated: a full-width character one size, any other a little over half. */
export declare const estimatedWidth: (t: TextLine) => number;
/** Whether p is inside the polygon (even-odd, so a notched chevron counts). */
export declare function inPolygon(p: Pt, pts: readonly Pt[]): boolean;
/** Fills `holders[i].texts`; returns the texts no shape took, in their order. */
export declare function fillHolders(holders: readonly Holder[], texts: readonly Placed[]): TextLine[];
/** A shape that may hold texts, drawn once its texts are known. */
export type Shape = Holder & {
    draw: (text?: string) => string;
};
export type Drawn = string | Shape;
export declare const bboxOf: (pts: readonly Pt[]) => Rect;
/** A closed outline (its steps, and the corner points it is hit-tested by) as a shape that may hold texts. */
export declare function outlineHolder(id: number, name: (texts: readonly TextLine[]) => string, steps: readonly PathStep[], corners: readonly Pt[], paint: Paint): Shape;
/** A closed polygon as a shape that may hold texts. */
export declare function polygonHolder(id: number, name: (texts: readonly TextLine[]) => string, pts: readonly Pt[], paint: Paint): Shape;
/** A shape of a given geometry over `rect` (a prstGeom, or a custGeom from roundGeomXml) that may hold texts. */
export declare function geomHolder(id: number, name: (texts: readonly TextLine[]) => string, rect: Rect, geom: string, paint: Paint, hit?: (p: Pt) => boolean): Shape;
/** The texts joined top to bottom: a shape's name when it holds them. */
export declare const joined: (texts: readonly TextLine[]) => string;
/** Draws the shapes in order, each holding the texts fillHolders gave it, then the texts no shape took as text boxes. */
export declare function drawAll(drawn: readonly Drawn[], texts: readonly Placed[], fonts: Fonts, next: () => number): string;
/** A shape drawn with drawParts: where it draws, and the part it is grouped in (ADR 0054). */
export interface PartDrawn {
    d: Drawn;
    geo: Geo;
    part?: string;
}
/** The text's area, estimated: what a part's group is sized by and what is checked for crossing. */
export declare const textGeo: (p: Placed) => Geo;
/** drawAll, with the shapes and texts of one part gathered into a group (parts-group.ts). `holds`: whether a text may go into a shape (default: all may). */
export declare function drawParts(drawn: readonly PartDrawn[], texts: readonly Placed[], fonts: Fonts, next: () => number, o?: {
    holds?: (p: Placed) => boolean;
}): string;
