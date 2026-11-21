import { type Pt } from './geom.ts';
import { type LineOpts, type PathStep } from './connectors.ts';
import { type Fonts, type Rect } from './xml.ts';
/** `fillOpacity`: 0 to 1 (a tinted area). */
export interface Paint {
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    widthPx?: number;
    dashed?: boolean;
    dotted?: boolean;
}
/** One line of text whose baseline is at (x, y), anchored as the svg anchors it. Not wrapped, so typing more makes it longer, not taller. */
export interface TextLine {
    text: string;
    x: number;
    y: number;
    anchor: 'start' | 'middle' | 'end';
    size: number;
    bold: boolean;
    color: string;
}
export declare function textLineXml(id: number, name: string, t: TextLine, fonts: Fonts): string;
/** The prstGeom of a preset, with its first adjustment if any. */
export declare const prstGeomXml: (prst: string, adj?: number) => string;
/** A preset shape (rect, roundRect, ellipse, diamond, triangle, ...) with no text. `adj` is the preset's first adjustment, if any. */
export declare function presetXml(id: number, name: string, prst: string, r: Rect, paint: Paint, adj?: number): string;
/** A shape of a given geometry (a prstGeom, or a custGeom from roundGeomXml), holding `text` (a txBody from boxTextXml) if given. */
export declare function geomShapeXml(id: number, name: string, r: Rect, geom: string, paint: Paint, text?: string): string;
/** Whether these lines can be the text of this box (boxTextXml can place every one at its anchor). */
export declare const boxTextFits: (r: Rect, lines: readonly TextLine[]) => boolean;
/** The width (px) of the text area boxTextXml gives these lines in this box (the box less its insets), or null when they cannot share one. */
export declare function boxTextWidth(r: Rect, lines: readonly TextLine[]): number | null;
/** `noWrap`: the text never wraps (a chip or badge sized to its word: PowerPoint's font may run a little wider than the measure). */
export declare function boxTextXml(r: Rect, lines: readonly TextLine[], fonts: Fonts, o?: {
    noWrap?: boolean;
}): string;
/** A closed polygon as a freeform shape (it keeps its points when moved, and its fill). */
export declare function polygonXml(id: number, name: string, points: readonly Pt[], paint: Paint): string;
/** A straight line from a to b, a connector (so it can be re-routed), with an arrowhead at b if asked. */
export declare function lineXml(id: number, name: string, a: Pt, b: Pt, color: string, widthPx: number, opts?: LineOpts): string;
/** The name of a shape: its text when it has some (what PowerPoint's selection pane shows), else the kind and id. */
/** A shape's name: its kind and text, or its kind alone (ADR 0054 D7: no running numbers; `id` is kept for the callers' sake). */
export declare const nameOf: (kind: string, _id: number, text?: string) => string;
/** Lines of text as one: joined as they are, with a space where a line break fell between two Latin words or numbers. */
export declare const linesText: (lines: readonly string[]) => string;
/** A shape's or group's name (ADR 0054 D7): its kind and text (40 characters at most), and its DSL id after it when it has one. */
export declare const namedAs: (kind: string, text: string, dslId?: string) => string;
/**
 * A diamond, ellipse, pill or hexagon (pointed left and right, as an obstacle) as a custGeom of w x h px whose text area is the whole box (a preset's is inset, which would move the text
 * off the layout's lines) and whose connection sites are the middles of the top, left, bottom and right sides: 0 to 3, as siteIndex counts.
 */
export declare function roundGeomXml(kind: 'diamond' | 'ellipse' | 'pill' | 'hex', w: number, h: number): string;
/** A filled shape of any outline (the steps of a path that closes), as a freeform. */
export declare function pathShapeXml(id: number, name: string, steps: readonly PathStep[], paint: Paint): string;
/** An svg `stroke-dasharray` as a DrawingML dash: dots when the dash is no longer than the line is wide, dashes otherwise. */
export declare const dashOfSvg: (dash: string | undefined) => Pick<Paint, 'dashed' | 'dotted'>;
/** A closed outline (path steps) as a custGeom over its bounding box `r`, its text area the whole box and its sites the middles of the
 *  box's top, left, bottom and right sides (0 to 3, as siteIndex counts). */
export declare function outlineGeomXml(steps: readonly PathStep[], r: Rect): string;
