import type { NodeLines } from './tree.ts';
import type { Roles, WidthOf, WrapMode } from './types/core.ts';
import type { Pt } from './graph-layout.ts';
/** The diamond that holds a text, as small as it can be: the text is a rectangle inscribed in it, `(tw + 2px) / W + (th + 2py) / H <= 1`
 *  with W : H = 1.6 : 1. Each extra line of text makes W wider (the text gets taller), so several widths of text are tried and the narrowest
 *  diamond wins; `maxW` only caps how wide a line of text may be (a larger cap never gives a wider diamond). */
export declare function diamondLines(label: string, sub: string | undefined, maxW: number, iconH: number, widthOf: WidthOf, roles: Roles, mode: WrapMode, floor: boolean): NodeLines;
/** A terminator: the box of the text, with room at both ends for the rounding (the radius is half the height). */
export declare function pillLines(l: NodeLines, iconH: number): NodeLines;
/** The four vertices of a diamond (top, right, bottom, left) inside rect r. */
export declare const diamondPoints: (r: {
    x: number;
    y: number;
    w: number;
    h: number;
}) => Pt[];
/**
 * An arrow that starts or ends on a diamond is routed to the rect's side; this moves that end along the arrow's last (first) segment onto
 * the outline. `end` is the point at the node's side, `next` its neighbour on the arrow. Other points are left as they are.
 */
export declare function ontoDiamond(end: Pt, next: Pt, r: {
    x: number;
    y: number;
    w: number;
    h: number;
}): Pt;
type R = {
    x: number;
    y: number;
    w: number;
    h: number;
};
/**
 * The arrows that leave a diamond straight down (the layout puts each target under the diamond, near its corners): start them at the
 * diamond's corners instead of at spots on its lower sides. Two arrows leave the left and right corners, a third the bottom one, so each
 * answer has its own corner. An arrow is moved only when its target's top edge is under the corner (it drops straight onto it) and nothing
 * stands in the way; any other arrow, and any that cannot move, keeps its path. `outs` are in the order of `paths`.
 */
export declare function vertexDrops(outs: {
    pts: Pt[];
    target: R;
}[], r: R, others: R[]): Pt[][];
export {};
