import type { LaidOutConnect } from './types/containers.ts';
/** A label that covers more than this share of the arrow, and leaves less than LABEL_VISIBLE_MIN px of it, hides which way it points (the arrowhead alone is ~10px). */
export declare const LABEL_COVER_MAX = 0.6;
export declare const LABEL_VISIBLE_MIN = 20;
/** How much of the connect's route lies under its label (the chip if there is one): the share (0..1) and the px left uncovered; undefined when there is no label rectangle. */
export declare function labelCover(c: Pick<LaidOutConnect, 'points' | 'labelBox' | 'chipBox'>): {
    share: number;
    visible: number;
} | undefined;
/** The label hides the arrow: it covers most of the route and leaves too little to read the direction from. */
export declare const hidesArrow: (cover: {
    share: number;
    visible: number;
}) => boolean;
