import type { Cand, ChartBox, ChartGeom, ChartOpts } from './charts-base.ts';
import { Canvas } from './charts-base.ts';
import type { Pt } from './graph-layout.ts';
export type SemnetDirection = 'LR' | 'TB';
export interface SemnetOpts extends ChartOpts {
    direction?: SemnetDirection;
    /** false: the plain coordinates only (default true: a straightened layout is used when it has strictly fewer crossings, then bends). */
    straighten?: boolean;
}
export declare const straightenOf: (who: string, v: boolean | undefined) => boolean;
type Rect = ReturnType<Canvas['boxOf']>;
type Fill = Parameters<Canvas['place']>[2];
type PlaceOpts = NonNullable<Parameters<Canvas['place']>[3]>;
export declare const direction: (who: string, d: SemnetDirection | undefined) => SemnetDirection;
export declare const validateNodes: (who: string, nodes: readonly {
    id: string;
    label: string;
}[], bandId?: string) => void;
export declare function arrow(c: Canvas, points: Pt[], { edge, ...o }: {
    stroke: 'accent' | 'danger' | 'muted' | 'text';
    sw?: number;
    dash?: string;
    of?: string; /** the edge this arrow draws: recorded in the chart's `edges` (a self-loop is not) */
    edge?: {
        from: string;
        to: string;
    };
}, mark?: boolean): void;
/** The box an arrow head fills (the head is drawn as a path, which the canvas does not register). */
export declare const headBox: (p: Pt[], sw?: number) => Rect;
export declare const edgeMid: (p: Pt[]) => Pt;
export declare const pathOf: (paths: Map<number, Pt[]>, i: number, e: {
    from: string;
    to: string;
}, positions: Map<string, {
    x: number;
    y: number;
    w: number;
    h: number;
}>) => Pt[];
/** Draws the label at the first candidate whose plate (2px wider than the text each side) is free, and that `also` accepts. */
export declare function placePlated(c: Canvas, text: string, cands: Cand[], fill: Fill, o: PlaceOpts, also?: (b: Rect) => boolean): ChartBox | undefined;
/**
 * The second stage of an edge label: beside the edge when there is room; otherwise on the edge itself, from the middle outwards. A label on the
 * edge hides the line under its plate, so it is taken only where the line stays visible on both sides (6px of the same segment beyond the plate),
 * the plate stays off every box (a plate is wider than its text), and it keeps off every arrow head in `heads` (the heads are not registered
 * on the canvas, so `free()` cannot see them).
 */
export declare function placeEdgeLabel(c: Canvas, text: string, p: Pt[], besideAt: (m: Pt) => Cand[], fill: Fill, o: PlaceOpts, heads?: readonly Rect[]): ChartBox | undefined;
/** Does the box reach any of these (arrow heads, say)? */
export declare const touchesAny: (b: Rect, boxes: readonly Rect[]) => boolean;
export declare function networkCanvas(g: ChartGeom, nodes: {
    id: string;
    label: string;
    w: number;
    h: number;
}[], edges: {
    from: string;
    to: string;
}[], dir: SemnetDirection, legendH?: number, straighten?: boolean, inset?: {
    top?: number;
    left?: number;
}): {
    c: Canvas;
    positions: Map<string, {
        x: number;
        y: number;
        w: number;
        h: number;
    }>;
    paths: Map<number, Pt[]>;
};
export declare function nodeBox(c: Canvas, p: {
    x: number;
    y: number;
    w: number;
    h: number;
}, id: string, _label: string, tone: 'accent' | 'danger' | 'muted' | 'text', critical?: boolean): number;
export {};
