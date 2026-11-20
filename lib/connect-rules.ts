// How much of an arrow its own label hides (pure: the route and the label's rectangle the layout left on the connect).
import {connectLabelWidth, labelRects} from './layout-connect.ts';
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

/** The label hides the arrow: it covers most of the route and leaves too little to read the direction from. */
export const hidesArrow = (cover: {share: number; visible: number}): boolean => cover.share > LABEL_COVER_MAX && cover.visible < LABEL_VISIBLE_MIN;

/** Clear space (px) between a label and the boxes (or frame lines) at either end of its arrow. */
export const LABEL_MARGIN = 6;

/**
 * Which way a labelled straight arrow runs (ADR 0069 D1): 'horizontal' (side to side), 'vertical' (bottom to top, both ends at the same x:
 * a plain label sits beside the line), 'slanted' (bottom to top with the ends at different x: a plain label sits on the line). Before
 * layout, when the x of the ends is not known yet, a vertical arrow is 'slanted' (the safe side).
 */
export type LabelAxis = 'horizontal' | 'vertical' | 'slanted';

/**
 * The length a straight route needs for its label (ADR 0069 D1), from `along` (E: the label's length along the route) and `covers`
 * (C: how much of the line the label lies on): long enough that the label clears both end boxes by LABEL_MARGIN with its middle at
 * `labelAt` (default 0.5), and that it does not hide the arrow (hidesArrow() does not hold). Infinity when `labelAt` is 0 or 1.
 */
export function roomFor(along: number, covers: number, labelAt = 0.5): number {
  const t = Math.min(labelAt, 1 - labelAt);
  const clear = t > 0 ? (along / 2 + LABEL_MARGIN) / t : Infinity;
  const visible = covers > 0 ? Math.min(covers / LABEL_COVER_MAX, covers + LABEL_VISIBLE_MIN) : 0;
  return Math.max(clear, visible);
}

/** E and C (see roomFor) of a label rectangle the layout made (labelRects()) on an arrow along `axis`. */
function extent(box: Rect, chip: boolean, axis: LabelAxis): {along: number; covers: number} {
  const along = axis === 'horizontal' ? box.w : box.h;
  return {along, covers: chip || axis === 'slanted' ? along : 0};
}

/**
 * The length (px) a straight connect's route needs for its label (ADR 0069 D1): what row gaps and the gaps between bands are widened to
 * (rounded up to the 4px grid), and what the checks name when a gap cannot be widened. The label's rectangle comes from the same formula
 * resolveConnect() uses (labelRects()).
 */
export function labelRoom(label: string, chip: boolean, axis: LabelAxis, labelAt: number | undefined, roles: Roles, widthOf: WidthOf): number {
  const {labelBox} = labelRects(connectLabelWidth(label, roles, widthOf), roles, chip);
  const {along, covers} = extent(labelBox, chip, axis);
  return roomFor(along, covers, labelAt);
}

/** labelRoom() of a laid-out straight connect, read off its label rectangle and route; undefined for another route or no label. */
export function connectRoom(c: Pick<LaidOutConnect, 'route' | 'points' | 'labelBox' | 'chipBox' | 'chip' | 'labelAt' | 'annot'>): number | undefined {
  const box = c.chipBox ?? c.labelBox, a = c.points[0], b = c.points[c.points.length - 1];
  if (!box || c.route !== 'straight' || c.annot || !a || !b) return undefined;
  const axis: LabelAxis = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'horizontal' : Math.round(a.x) === Math.round(b.x) ? 'vertical' : 'slanted';
  const {along, covers} = extent(box, !!c.chip, axis);
  return roomFor(along, covers, c.labelAt);
}

/** A length rounded up to the 4px grid. */
export const ceil4 = (n: number): number => Math.ceil(n / 4 - 1e-9) * 4;
