import { elements, type El, type Matrix, type Style } from './svg-dom.ts';
import type { FontFamily } from './types/core.ts';
export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}
export type Point = [number, number];
export declare const boxOf: (pts: Point[]) => Box | null;
export declare const unionBox: (boxes: (Box | null)[]) => Box | null;
export declare const corners: (b: Box) => Point[];
export declare const transformBox: (b: Box, m: Matrix) => Box;
/** The sub-paths of a path's `d` as polylines (curves and arcs flattened), each with whether it was closed, and the exact extreme points of its curves (the box of a curve is not the box of its flattening). */
export declare function flattenPath(d: string): {
    pts: Point[];
    closed: boolean;
    extrema: Point[];
}[];
export interface Outline {
    polylines: Point[][];
    box: Box | null; /** every point that bounds the shape: the polylines' and the curves' extreme points */
    points: Point[];
}
export declare const isShape: (e: El) => boolean;
/** A shape's outline as polylines in its own coordinates (what a point-along-the-length walk follows) and its box. `vp` resolves percentages. */
export declare function outlineOf(el: El, vp: {
    w: number;
    h: number;
}): Outline;
/** Points along a polyline every `step` (and its end), for asking whether it passes through a box. */
export declare function sampleAlong(polyline: Point[], step: number): Point[];
/** The font family kind a CSS font-family list resolves to for measuring. */
export declare function familyKind(fontFamily: string): FontFamily;
/** The box of a line of text in a font: its advance and the ascent / descent of the primary font. Given by the caller (the font files are a shell's). */
export type TextBoxFn = (text: string, family: FontFamily, size: number, weight: number) => {
    w: number;
    ascent: number;
    descent: number;
};
/** One run of a <text> (the text of one tspan, or of the <text> itself) as it is laid out: where its pen starts and how big it is. */
export interface PlacedRun {
    s: string;
    style: Style;
    x: number;
    y: number;
    w: number;
    ascent: number;
    descent: number;
}
/** The runs of a <text> element (its tspans included) with the positions they are drawn at, in its own coordinates. */
export declare function placeRuns(text: El, styles: Map<El, Style>, measure: TextBoxFn): PlacedRun[];
/** The box of a <text> element (its tspans included) in its own coordinates, or null when it draws nothing. */
export declare function textBoxOf(text: El, styles: Map<El, Style>, measure: TextBoxFn): Box | null;
export declare const textContent: (e: El) => string;
export { elements };
