export interface HopPt {
    x: number;
    y: number;
}
export interface HopEdge {
    from: string;
    to: string;
    points: HopPt[];
    line: 'solid' | 'dashed' | 'dotted';
    back?: true;
    reversed?: true;
    kind?: 'blocks';
}
export type HopFlow = 'up' | 'down' | 'right' | 'left';
export type HopSkip = 'dashed' | 'corner' | 'arrowhead' | 'bar' | 'neighbour' | 'and-arc' | 'band' | 'parallel';
export interface Crossing {
    over: number;
    under: number;
    x: number;
    y: number; /** the unit step the hop bulges toward (against the flow) */
    side: HopPt;
    skipped?: HopSkip;
}
export declare const HOP_R = 6;
export declare const ARROW_L = 12;
/**
 * The crossings of every return's run across the layers (with `everyRun`, of every arrow's run across the layers) (a run at a right angle to the flow) with another line, in the order of the returns, each marked `skipped` when
 * it gets no hop. `rooms` are the boxes of the nodes and the band; `ands` the AND arcs (p0, c, p1).
 */
export declare function causeCrossings(edges: readonly HopEdge[], flow: HopFlow, band: {
    x: number;
    y: number;
    w: number;
    h: number;
}, boxes: readonly {
    x: number;
    y: number;
    w: number;
    h: number;
}[], ands: readonly {
    p0: HopPt;
    c: HopPt;
    p1: HopPt;
}[], everyRun?: boolean): Crossing[];
