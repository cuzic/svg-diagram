// How much of an arrow its own label hides (pure: the route and the label's rectangle the layout left on the connect).
import {connectLabelWidth, labelRects} from './connect-geometry.ts';
import type {LaidOutConnect} from './types/containers.ts';
import type {Rect, Roles, WidthOf} from './types/core.ts';

/** A label that covers more than this share of the arrow, and leaves less than LABEL_VISIBLE_MIN px of it, hides which way it points (the arrowhead alone is ~10px). */
export const LABEL_COVER_MAX = 0.6;
export const LABEL_VISIBLE_MIN = 20;

/** The part of segment a-b inside the rectangle, as a length (Liang-Barsky clipping). */
function clippedLength(a: {x: number; y: number}, b: {x: number; y: number}, r: Rect): number {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - r.x], [dx, r.x + r.w - a.x], [-dy, a.y - r.y], [dy, r.y + r.h - a.y]] as const) {
    if (p === 0) { if (q < 0) return 0; continue; }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return 0;
  }
  return (t1 - t0) * Math.hypot(dx, dy);
}

/** How much of the connect's route lies under its label (the chip if there is one): the share (0..1) and the px left uncovered; undefined when there is no label rectangle. */
export function labelCover(c: Pick<LaidOutConnect, 'points' | 'labelBox' | 'chipBox'>): {share: number; visible: number} | undefined {
  const box = c.chipBox ?? c.labelBox;
  if (!box) return undefined;
  let total = 0, covered = 0;
  for (let i = 0; i + 1 < c.points.length; i++) {
    const a = c.points[i], b = c.points[i + 1];
    if (!a || !b) continue;
    total += Math.hypot(b.x - a.x, b.y - a.y);
    covered += clippedLength(a, b, box);
  }
  return total > 0 ? {share: covered / total, visible: total - covered} : undefined;
}

/**
 * The label hides the arrow: it covers most of the route and leaves too little to read the direction from. A route exactly as long as
 * roomFor() asks for is not hidden (the share and the visible part are compared with a hair of tolerance: a route of 316px under a 296px chip
 * leaves 19.99999999999994px in floating point).
 */
export const hidesArrow = (cover: {share: number; visible: number}): boolean => cover.share > LABEL_COVER_MAX + 1e-9 && cover.visible < LABEL_VISIBLE_MIN - 1e-6;

/** Clear space (px) between a label and the boxes (or frame lines) at either end of its arrow. */
export const LABEL_MARGIN = 6;

/**
 * Which way a labelled straight arrow runs (ADR 0069 D1): 'horizontal' (side to side), 'vertical' (bottom to top, both ends at the same x:
 * a plain label sits beside the line, centred on it), 'slanted' (bottom to top with the ends at different x: a plain label sits just above
 * the point on the line, as on a horizontal line). Before layout, when the x of the ends is not known, a vertical arrow is 'slanted' (the safe side).
 */
export type LabelAxis = 'horizontal' | 'vertical' | 'slanted';

/** How far (px) a plain label's text sits above its point on a line that is not vertical (resolveConnect's `dy`: the baseline 6px up, the rectangle 2px further down). */
const PLAIN_LIFT = 2;

/**
 * The length a straight route needs for its label (ADR 0069 D1), from `along` (E: the label's length along the route, as if centred on its
 * point) and `covers` (C: how much of the line the label lies on): long enough that the label clears both end boxes by `margin` (default
 * LABEL_MARGIN) with its point at `labelAt` (default 0.5), and that it does not hide the arrow (hidesArrow() does not hold). Infinity when
 * `labelAt` is 0 or 1. With `margin` 0 it is the length under which the checks fire.
 */
export function roomFor(along: number, covers: number, labelAt = 0.5, margin = LABEL_MARGIN): number {
  const t = Math.min(labelAt, 1 - labelAt);
  const clear = t > 0 ? (along / 2 + margin) / t : Infinity;
  const visible = covers > 0 ? Math.min(covers / LABEL_COVER_MAX, covers + LABEL_VISIBLE_MIN) : 0;
  return Math.max(clear, visible);
}

/**
 * E and C (see roomFor) of a label rectangle the layout made (labelRects()) on an arrow along `axis`. On a slanted line a plain label is
 * not centred on its point: its top is h + 2 above it, so E is twice that (whichever end is above). The line crosses the label's height
 * there (C = h): once the route clears the ends, it is at least 2h + 4 high, so the label covers under half of it.
 */
function extent(box: Rect, chip: boolean, axis: LabelAxis): {along: number; covers: number} {
  if (chip) { const along = axis === 'horizontal' ? box.w : box.h; return {along, covers: along}; }
  if (axis === 'horizontal') return {along: box.w, covers: 0};
  if (axis === 'vertical') return {along: box.h, covers: 0};
  return {along: 2 * (box.h + PLAIN_LIFT), covers: box.h};
}

/**
 * The length (px) a straight connect's route needs for its label (ADR 0069 D1): what row gaps and the gaps between bands are widened to
 * (rounded up to the 4px grid), and what the checks name when a gap cannot be widened. The label's rectangle comes from the same formula
 * resolveConnect() uses (labelRects()). `margin` 0: the length under which the checks fire.
 */
export function labelRoom(label: string, chip: boolean, axis: LabelAxis, labelAt: number | undefined, roles: Roles, widthOf: WidthOf, margin = LABEL_MARGIN): number {
  const {labelBox} = labelRects(connectLabelWidth(label, roles, widthOf), roles, chip);
  const {along, covers} = extent(labelBox, chip, axis);
  return roomFor(along, covers, labelAt, margin);
}

const sideOf = (ref: string): string => (ref.split(':')[1] ?? 'center').split('@')[0] ?? 'center';

/**
 * labelRoom() of a laid-out straight connect, read off its label rectangle and its ends: undefined for another route, no label, or ends that
 * do not face each other (right → left with the target to the right, bottom → top with the target below, or the reverse), where the
 * length between the boxes is not what the label needs. The axis comes from the sides, not from the slope.
 */
export function connectRoom(c: Pick<LaidOutConnect, 'route' | 'points' | 'labelBox' | 'chipBox' | 'chip' | 'labelAt' | 'annot' | 'fromLabel' | 'toLabel'>): number | undefined {
  const box = c.chipBox ?? c.labelBox, a = c.points[0], b = c.points[c.points.length - 1];
  if (!box || c.route !== 'straight' || c.annot || !a || !b) return undefined;
  const f = sideOf(c.fromLabel), t = sideOf(c.toLabel);
  const across = (f === 'right' && t === 'left' && b.x >= a.x) || (f === 'left' && t === 'right' && b.x <= a.x);
  const down = (f === 'bottom' && t === 'top' && b.y >= a.y) || (f === 'top' && t === 'bottom' && b.y <= a.y);
  if (!across && !down) return undefined;
  const axis: LabelAxis = across ? 'horizontal' : Math.round(a.x) === Math.round(b.x) ? 'vertical' : 'slanted';
  const {along, covers} = extent(box, !!c.chip, axis);
  return roomFor(along, covers, c.labelAt);
}

/** A length rounded up to the 4px grid. */
export const ceil4 = (n: number): number => Math.ceil(n / 4 - 1e-9) * 4;
