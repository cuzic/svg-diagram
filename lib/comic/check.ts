// The checks of comic() that read the laid-out geometry (ADR 0074 D6): a bubble over a face, a tail that does not point at its speaker's mouth.
import {HEAD_KEEP, TAIL_TOLERANCE} from './constants.ts';
import type {ComicFinding, ComicLaidBubble, ComicLaidHead, ComicRule} from '../types/comic.ts';
import type {Rect} from '../types/core.ts';

export type Report = (rule: ComicRule, where: string, message: string, severity?: ComicFinding['severity']) => void;

const rectHitsCircle = (r: Rect, cx: number, cy: number, rad: number): boolean => {
  const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w)), dy = Math.max(r.y - cy, 0, cy - (r.y + r.h));
  return dx * dx + dy * dy < rad * rad;
};

/** comic-bubble-covers-face: the bubble reaches the head circle (plus HEAD_KEEP). */
export function checkBubbleFace(b: ComicLaidBubble, h: ComicLaidHead, report: Report): void {
  if (rectHitsCircle(b, h.cx, h.cy, h.r + HEAD_KEEP)) report('comic-bubble-covers-face', b.id, `${b.id} covers the head of ${h.name} (the bubble must stay ${HEAD_KEEP}px away from the face)`);
}

/** The angle between the tail's direction (base to tip) and the direction from the base to the speaker's mouth, in radians. */
export function tailAngle(tail: NonNullable<ComicLaidBubble['tail']>, mouth: readonly [number, number]): number {
  const ax = tail.tip[0] - tail.from[0], ay = tail.tip[1] - tail.from[1], bx = mouth[0] - tail.from[0], by = mouth[1] - tail.from[1];
  const n = Math.hypot(ax, ay) * Math.hypot(bx, by);
  return n === 0 ? 0 : Math.acos(Math.min(1, Math.max(-1, (ax * bx + ay * by) / n)));
}

/** comic-tail-off-speaker: the tail points more than 10 degrees away from the speaker's mouth. */
export function checkTail(b: ComicLaidBubble, speaker: ComicLaidHead, report: Report): void {
  if (!b.tail) return;
  const a = tailAngle(b.tail, speaker.mouth);
  if (a > TAIL_TOLERANCE) report('comic-tail-off-speaker', b.id, `the tail of ${b.id} points ${Math.round(a * 180 / Math.PI)} degrees away from the mouth of ${speaker.name} (limit 10)`);
}
