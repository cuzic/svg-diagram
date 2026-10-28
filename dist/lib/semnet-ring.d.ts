import { Canvas } from './charts-base.ts';
import type { ChartGeom } from './charts-base.ts';
import type { Pt } from './graph-layout.ts';
import type { CausalLink, CausalLoop } from './semnet-analysis.ts';
type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export declare const RING_MIN = 2, RING_MAX = 8;
/** What a ring needs: exactly one loop of 2-8 nodes (self links aside) that every node is on, and no link besides the loop's own. */
export declare function checkRing(nodes: readonly {
    id: string;
}[], links: readonly CausalLink[], loops: readonly CausalLoop[], direction: unknown): void;
export interface RingLayout {
    c: Canvas;
    positions: Map<string, Rect>;
    paths: Map<number, Pt[]>;
    centre: Pt;
}
/**
 * `loop.nodes` go clockwise from the top. rx follows from the width; ry is the first of 60, 68, ... where neighbours keep GAP between their boxes,
 * no two boxes touch and no arc runs through a box that is not its end. The canvas is as high as that needs, unless `height` says more (and fails if it says less).
 */
export declare function layoutRing(g: ChartGeom, ns: readonly {
    id: string;
    label: string;
    w: number;
    h: number;
}[], loop: CausalLoop, selfLinks: readonly {
    index: number;
    node: string;
}[], inset?: {
    top?: number;
    bottom?: number;
}): RingLayout;
export {};
