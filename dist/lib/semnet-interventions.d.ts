import type { Canvas } from './charts-base.ts';
import type { Pt } from './graph-layout.ts';
type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
/** Which edge of the figure a box sits on: LR is `top`, TB is `left`, a ring uses `top` and `bottom` (the outside of the ring). */
export type Side = 'top' | 'bottom' | 'left';
export declare const BOX_H = 48, ARROW = 40, GAP = 16, MARGIN = 8;
export interface IvItem {
    id: string;
    label: string;
    to: readonly string[];
    w: number;
}
export interface PlacedIv {
    item: IvItem;
    box: Rect;
    arrows: {
        to: string;
        path: Pt[];
    }[];
}
/** How much of the figure's `side` the band takes, `attempt` times 8px thicker each retry (the layout is given this much less room). */
export declare const bandInset: (side: Side, items: readonly IvItem[], attempt: number) => number;
/** On a ring: a node in the upper half of the ellipse (the top included) is reached from above, the others from below. */
export declare function ringSide(loopNodes: readonly string[], to: readonly string[]): Side;
/**
 * Boxes in order of where their targets are, pushed apart by GAP (forwards, then back from the end), each with one arrow per target:
 * straight when the box and the target share a stretch, otherwise down, across and down. An arrow may cross a loop link but not a node box.
 */
export declare function planInterventions(c: Canvas, items: readonly IvItem[], positions: ReadonlyMap<string, Rect>, sideOf: (it: IvItem) => Side): {
    placed: PlacedIv[];
} | {
    problem: string;
};
export {};
