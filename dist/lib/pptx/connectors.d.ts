import type { ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutConnect } from '../types/containers.ts';
import type { ConnXfrm } from './geom.ts';
export interface Glue {
    id: number;
    idx: number;
}
/** A straight arrow between two boxes of a `row` band, 2.5px as the svg draws it. */
export declare function rowArrowXml(id: number, name: string, x: ConnXfrm, start?: Glue, end?: Glue): string;
/** A `bentConnector` fitted to the routed points, glued at either end where the shape is a native one. */
export declare function connectorXml(id: number, c: LaidOutConnect, x: ConnXfrm, day: LaidOutDiagram['day'], tones: ToneEnv, start?: Glue, end?: Glue): string;
/** The fallback for a route no connector preset fits (and for annotations): a polyline, not glued. */
export declare function freeformXml(id: number, c: LaidOutConnect, day: LaidOutDiagram['day'], tones: ToneEnv): string;
/** A connector of a band's own lines (a tree's), in a colour and width of its own, with no arrowhead; glued where the ends are shapes. */
export declare function connectorShapeXml(id: number, name: string, x: Omit<ConnXfrm, 'prst'> & {
    prst: string;
}, color: string, widthPx: number, start?: Glue, end?: Glue, opts?: LineOpts): string;
/** How a band's own line is drawn: dashed or dotted, and with an arrowhead at its end. */
/** The shape of a line end: a filled triangle, an open V (`arrow`), or a filled diamond. */
export type EndType = 'triangle' | 'arrow' | 'diamond';
/** `arrow`: a triangle at the end; `heads` names the ends explicitly; `ends` names each end's shape (and wins over both). */
export interface LineOpts {
    dashed?: boolean;
    dotted?: boolean;
    arrow?: boolean;
    heads?: 'start' | 'end' | 'both' | 'none';
    ends?: {
        start?: EndType;
        end?: EndType;
    }; /** The length (px) of the svg's mark at each end, when known (else the svg's usual head for the width). */
    headPx?: {
        start?: number;
        end?: number;
    };
}
/** One step of a freeform path: move, line, quadratic curve (control, end), cubic curve (two controls, end), or close. */
export interface PathStep {
    op: 'M' | 'L' | 'Q' | 'C' | 'Z';
    pts: {
        x: number;
        y: number;
    }[];
}
/** An open freeform path (no fill), not glued: a brace, or a line no connector preset fits. */
export declare function freeformPathXml(id: number, name: string, steps: readonly PathStep[], color: string, widthPx: number, opts?: LineOpts): string;
/** The DrawingML of a path's steps, its points mapped by `pt`. */
export declare const pathXml: (steps: readonly PathStep[], pt: (p: {
    x: number;
    y: number;
}) => string) => string;
