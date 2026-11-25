import type { ComicFinding, ComicLaidBubble, ComicLaidHead, ComicRule } from '../types/comic.ts';
import type { Rect } from '../types/core.ts';
export type Report = (rule: ComicRule, where: string, message: string, severity?: ComicFinding['severity']) => void;
/** comic-bubble-covers-face: the bubble reaches the head circle (plus HEAD_KEEP). */
export declare function checkBubbleFace(b: ComicLaidBubble, h: ComicLaidHead, report: Report): void;
/** The angle between the tail's direction (base to tip) and the direction from the base to the speaker's mouth, in radians. */
export declare function tailAngle(tail: NonNullable<ComicLaidBubble['tail']>, mouth: readonly [number, number]): number;
/** comic-tail-off-speaker: the tail points more than 10 degrees away from the speaker's mouth, or its tip is inside the head. */
export declare function checkTail(b: ComicLaidBubble, speaker: ComicLaidHead, report: Report): void;
/** Does the tail (its centre line and both sides of the wedge) run through the rectangle of another bubble? */
export declare const tailCrosses: (tail: NonNullable<ComicLaidBubble['tail']>, other: Rect) => boolean;
