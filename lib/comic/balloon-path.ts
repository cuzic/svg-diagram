// Comic balloons share the rounded outline generator and keep their own styling dimensions.
import {balloonOutline} from '../shapes/balloon.ts';

export type BalloonKind = 'say' | 'think' | 'shout' | 'narration';
export interface BalloonBody {x: number; y: number; w: number; h: number}
export interface BalloonTail {
  /** The point the tail ends in. */
  tip: readonly [number, number];
  /** Half the width of the wedge where it leaves the body (default 8). */
  halfWidth?: number;
}
export interface BalloonOutline {
  /** The closed outline, clockwise from the top edge. */
  d: string;
  /** Where the wedge meets the body (left out when there is no tail). */
  base?: [[number, number], [number, number]];
}

/** The corner radius of a body: `say` and `think` (the same shape, dashed) are rounded to the ends (at most 24), `shout` is nearly square, `narration` is square. */
export const balloonRadius = (kind: BalloonKind, h: number): number => kind === 'say' || kind === 'think' ? Math.min(h / 2, 24) : kind === 'shout' ? 6 : 0;

export function balloonPath(body: BalloonBody, kind: BalloonKind, tail?: BalloonTail): BalloonOutline {
  const radius = Math.min(balloonRadius(kind, body.h), body.w / 2);
  const {d, base} = balloonOutline('round', body, kind === 'narration' ? undefined : tail?.tip, {
    radius, halfWidth: tail?.halfWidth ?? 8,
  });
  if (!base) return {d};
  return {d, base: [[...base[0]], [...base[1]]]};
}
