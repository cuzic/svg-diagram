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
}
export declare function moveApart({ routes, edges, rects }: ApartIn): Map<number, Pt[]>;
