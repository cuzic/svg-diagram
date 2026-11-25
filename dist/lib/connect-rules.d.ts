import type { LaidOutConnect } from './types/containers.ts';
import type { Roles, WidthOf } from './types/core.ts';
/** A label that covers more than this share of the arrow, and leaves less than LABEL_VISIBLE_MIN px of it, hides which way it points (the arrowhead alone is ~10px). */
export declare const LABEL_COVER_MAX = 0.6;
export declare const LABEL_VISIBLE_MIN = 20;
/** How much of the connect's route lies under its label (the chip if there is one): the share (0..1) and the px left uncovered; undefined when there is no label rectangle. */
export declare function labelCover(c: Pick<LaidOutConnect, 'points' | 'labelBox' | 'chipBox'>): {
    share: number;
    visible: number;
} | undefined;
/**
 * The label hides the arrow: it covers most of the route and leaves too little to read the direction from. A route exactly as long as
 * roomFor() asks for is not hidden (the share and the visible part are compared with a hair of tolerance: a route of 316px under a 296px chip
 * leaves 19.99999999999994px in floating point).
 */
export declare const hidesArrow: (cover: {
    share: number;
    visible: number;
}) => boolean;
/** Clear space (px) between a label and the boxes (or frame lines) at either end of its arrow. */
export declare const LABEL_MARGIN = 6;
/**
 * Which way a labelled straight arrow runs (ADR 0069 D1): 'horizontal' (side to side), 'vertical' (bottom to top, both ends at the same x:
 * a plain label sits beside the line, centred on it), 'slanted' (bottom to top with the ends at different x: a plain label sits just above
 * the point on the line, as on a horizontal line). Before layout, when the x of the ends is not known, a vertical arrow is 'slanted' (the safe side).
 */
export type LabelAxis = 'horizontal' | 'vertical' | 'slanted';
/**
 * The length a straight route needs for its label (ADR 0069 D1), from `along` (E: the label's length along the route, as if centred on its
 * point) and `covers` (C: how much of the line the label lies on): long enough that the label clears both end boxes by `margin` (default
 * LABEL_MARGIN) with its point at `labelAt` (default 0.5), and that it does not hide the arrow (hidesArrow() does not hold). Infinity when
 * `labelAt` is 0 or 1. With `margin` 0 it is the length under which the checks fire.
 */
export declare function roomFor(along: number, covers: number, labelAt?: number, margin?: number): number;
/**
 * The length (px) a straight connect's route needs for its label (ADR 0069 D1): what row gaps and the gaps between bands are widened to
 * (rounded up to the 4px grid), and what the checks name when a gap cannot be widened. The label's rectangle comes from the same formula
 * resolveConnect() uses (labelRects()). `margin` 0: the length under which the checks fire.
 */
export declare function labelRoom(label: string, chip: boolean, axis: LabelAxis, labelAt: number | undefined, roles: Roles, widthOf: WidthOf, margin?: number): number;
/**
 * labelRoom() of a laid-out straight connect, read off its label rectangle and its ends: undefined for another route, no label, or ends that
 * do not face each other (right → left with the target to the right, bottom → top with the target below, or the reverse), where the
 * length between the boxes is not what the label needs. The axis comes from the sides, not from the slope.
 */
export declare function connectRoom(c: Pick<LaidOutConnect, 'route' | 'points' | 'labelBox' | 'chipBox' | 'chip' | 'labelAt' | 'annot' | 'fromLabel' | 'toLabel'>): number | undefined;
/** A length rounded up to the 4px grid. */
export declare const ceil4: (n: number) => number;
