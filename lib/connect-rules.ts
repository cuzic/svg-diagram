// How much of an arrow its own label hides (pure: the route and the label's rectangle the layout left on the connect).
import type {LaidOutConnect} from './types/containers.ts';
import type {Rect} from './types/core.ts';

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
