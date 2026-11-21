import type { Pt } from './graph-layout.ts';
export interface ApartEdge {
    from: string;
    to: string;
    self?: boolean;
    outer?: boolean;
}
export interface ApartIn {
    routes: ReadonlyMap<number, Pt[]>;
    edges: ReadonlyMap<number, ApartEdge>;
    /** The boxes of the placed figure by id. A move may not leave the area the boxes and routes already take. */
    rects: ReadonlyMap<string, {
        x0: number;
        x1: number;
        y0: number;
        y1: number;
    }>;
    /** The shortest last run into the head of an arrow (by its key in `routes`): room for the arrowhead, and for an AND's arc (ADR 0070 D8). Default 22. */
    headRun?: (edge: number) => number;
    /** ADR 0070 D4 (U4c): a move may not add a pair of runs under this far apart, nor two runs on one line whose ends are under it apart (`runPairs`). Default: not asked. */
    sep?: number;
    /** ADR 0070 D7: the scale of the lines (a cause tree's own band on a canvas): `CLEAR`, `JOG` and the steps are multiplied by it. Default 1. */
    scale?: number;
}
export declare function moveApart({ routes, edges, rects, headRun, sep, scale }: ApartIn): Map<number, Pt[]>;
