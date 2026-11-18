import type { Pt } from './geom.ts';
import type { Rect } from './xml.ts';
/** Where a shape draws: an area (a box, a text, a filled outline), or a line of some width (an open or closed polyline). */
export type Geo = {
    kind: 'rect';
    r: Rect;
} | {
    kind: 'poly';
    pts: Pt[];
    w: number;
    closed?: boolean;
};
/** A shape as written: its place in drawing order, its xml, its part's steps and where it draws. */
export interface Piece {
    order: number;
    xml: string;
    part: readonly string[];
    geo: Geo; /** A text, or a shape holding one (a label on its plate): it keeps its order against every other part (ADR 0054 D9.1). */
    text?: boolean;
}
/** Whether two shapes overlap by more than SLACK (so the order they are drawn in can show). */
export declare function crosses(g: Geo, h: Geo): boolean;
/** The name of a part's group: its kind and label, and its DSL id when it has one (`class: 注文 [u1]`). */
export declare function partName(step: string): string;
/** The pieces as xml in drawing order, the pieces of each part (at `depth`) gathered into a group. Also reports the pieces left out. */
export declare function assembleParts(pieces: readonly Piece[], next: () => number, depth?: number, left?: Piece[]): string;
