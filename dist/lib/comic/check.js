// The checks of comic() that read the laid-out geometry (ADR 0074 D6): a bubble over a face, a tail that does not point at its speaker's mouth.
import { HEAD_KEEP, TAIL_TOLERANCE } from './constants.js';
const rectHitsCircle = (r, cx, cy, rad) => {
    const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w)), dy = Math.max(r.y - cy, 0, cy - (r.y + r.h));
    return dx * dx + dy * dy < rad * rad;
};
/** comic-bubble-covers-face: the bubble reaches the head circle (plus HEAD_KEEP). */
export function checkBubbleFace(b, h, report) {
    if (rectHitsCircle(b, h.cx, h.cy, h.r + HEAD_KEEP))
        report('comic-bubble-covers-face', b.id, `${b.id} covers the head of ${h.name} (the bubble must stay ${HEAD_KEEP}px away from the face)`);
}
/** The angle between the tail's direction (base to tip) and the direction from the base to the speaker's mouth, in radians. */
export function tailAngle(tail, mouth) {
    const ax = tail.tip[0] - tail.from[0], ay = tail.tip[1] - tail.from[1], bx = mouth[0] - tail.from[0], by = mouth[1] - tail.from[1];
    const n = Math.hypot(ax, ay) * Math.hypot(bx, by);
    return n === 0 ? 0 : Math.acos(Math.min(1, Math.max(-1, (ax * bx + ay * by) / n)));
}
/** comic-tail-off-speaker: the tail points more than 10 degrees away from the speaker's mouth, or its tip is inside the head. */
export function checkTail(b, speaker, report) {
    if (!b.tail)
        return;
    const a = tailAngle(b.tail, speaker.mouth);
    if (a > TAIL_TOLERANCE)
        report('comic-tail-off-speaker', b.id, `the tail of ${b.id} points ${Math.round(a * 180 / Math.PI)} degrees away from the mouth of ${speaker.name} (limit 10)`);
    if (Math.hypot(b.tail.tip[0] - speaker.cx, b.tail.tip[1] - speaker.cy) < speaker.r)
        report('comic-tail-off-speaker', b.id, `the tail of ${b.id} ends inside the head of ${speaker.name} (leave more room between the bubble and the face)`);
}
const onSegment = (p, q, r) => {
    // does the segment p-q touch the rectangle? (the rectangle shrunk by half a pixel, so a tail that only grazes a bubble's outline is not counted)
    const x0 = r.x + 0.5, y0 = r.y + 0.5, x1 = r.x + r.w - 0.5, y1 = r.y + r.h - 0.5;
    let t0 = 0, t1 = 1;
    const dx = q[0] - p[0], dy = q[1] - p[1];
    for (const [d, lo, hi, o] of [[dx, x0, x1, p[0]], [dy, y0, y1, p[1]]]) {
        if (d === 0) {
            if (o < lo || o > hi)
                return false;
            continue;
        }
        let a = (lo - o) / d, b = (hi - o) / d;
        if (a > b)
            [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        if (t0 > t1)
            return false;
    }
    return true;
};
/** Does the tail (its centre line and both sides of the wedge) run through the rectangle of another bubble? */
export const tailCrosses = (tail, other) => onSegment(tail.from, tail.tip, other) || onSegment(tail.base[0], tail.tip, other) || onSegment(tail.base[1], tail.tip, other);
