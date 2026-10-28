import { type Rect } from './xml.ts';
export interface Pt {
    x: number;
    y: number;
}
export interface ConnXfrm {
    prst: 'straightConnector1' | 'bentConnector2' | 'bentConnector3' | 'bentConnector4' | 'bentConnector5';
    /** EMU */
    offX: number;
    offY: number;
    extX: number;
    extY: number;
    rot: 0 | 5400000;
    flipH: boolean;
    flipV: boolean;
    /** 1/100000, in avLst order (adj1..adj3) */
    adj: number[];
}
/** Drop repeated points and the middle point of a straight run. */
export declare function simplify(points: Pt[]): Pt[];
export type FitResult = {
    ok: true;
    x: ConnXfrm;
} | {
    ok: false;
    why: string;
};
export declare function fitConnector(raw: Pt[]): FitResult;
/** The polyline (px) a connector draws, from its xfrm + preset. */
export declare function evalConnector(c: ConnXfrm): Pt[];
/** Largest distance between the two polylines, vertex by vertex (both simplified first); Infinity when the vertex counts differ. */
export declare function maxDeviation(a: Pt[], b: Pt[]): number;
/** The connection site (0 top, 1 left, 2 bottom, 3 right) of a rectangle a route end belongs to: the side named in the label (`"id:top"`), else the nearest. */
export declare function siteIndex(box: Rect, p: Pt, label: string): number;
