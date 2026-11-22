// The outline of a speech balloon: the body (a rounded rectangle) and its tail as ONE closed path. A pure, self-contained function (it imports nothing
// from comic()): the general speech-balloon shapes can reuse it, and it can move to lib/shapes/ unchanged.
//
//   balloonPath({x, y, w, h}, 'say', {tip: [x, y]})  ->  {d: 'M… Z', base: [[x, y], [x, y]]}
//
// The tail leaves the side of the body that the line from the body's centre to the tip crosses, as a wedge on the straight part of that side.
// `tip` must be outside the body: a tip inside it, or not a finite number, draws no tail. A side whose straight part is narrower than the wedge gets a narrower wedge.
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

const f1 = (n: number): number => Math.round(n * 10) / 10;
type Side = 'top' | 'right' | 'bottom' | 'left';

export function balloonPath(body: BalloonBody, kind: BalloonKind, tail?: BalloonTail): BalloonOutline {
  const {x, y, w, h} = body, r = Math.min(balloonRadius(kind, h), w / 2);
  const right = x + w, bottom = y + h;
  const arc = (px: number, py: number): string => r > 0 ? `A${r} ${r} 0 0 1 ${f1(px)} ${f1(py)}` : '';
  let wedge: {side: Side; base: [[number, number], [number, number]]; tip: [number, number]} | undefined;
  const outside = tail?.tip.every(Number.isFinite) && !(tail.tip[0] > x && tail.tip[0] < right && tail.tip[1] > y && tail.tip[1] < bottom);
  if (tail && outside && kind !== 'narration') {
    const dx = tail.tip[0] - (x + w / 2), dy = tail.tip[1] - (y + h / 2);
    // the side the line from the centre to the tip leaves through
    const side: Side = Math.abs(dx) * h > Math.abs(dy) * w ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
    const along = side === 'top' || side === 'bottom';
    const straight = (along ? w : h) - 2 * r; // the straight part of the side
    const half = Math.min(tail.halfWidth ?? 8, straight / 2);
    const lo = (along ? x : y) + r + half, hi = (along ? right : bottom) - r - half;
    const t = Math.min(Math.max(along ? tail.tip[0] : tail.tip[1], lo), hi); // the wedge stays on the straight part
    const at = (c: number): [number, number] => side === 'top' ? [c, y] : side === 'bottom' ? [c, bottom] : side === 'left' ? [x, c] : [right, c];
    // listed in the order the outline runs: top and bottom left to right / right to left, right down, left up
    const [a, b] = side === 'top' || side === 'right' ? [at(t - half), at(t + half)] : [at(t + half), at(t - half)];
    if (half >= 1) wedge = {side, base: [a, b], tip: [tail.tip[0], tail.tip[1]]};
  }
  const cut = (side: Side): string => wedge?.side === side ? `L${f1(wedge.base[0][0])} ${f1(wedge.base[0][1])}L${f1(wedge.tip[0])} ${f1(wedge.tip[1])}L${f1(wedge.base[1][0])} ${f1(wedge.base[1][1])}` : '';
  const d = `M${f1(x + r)} ${f1(y)}${cut('top')}H${f1(right - r)}${arc(right, y + r)}${cut('right')}V${f1(bottom - r)}${arc(right - r, bottom)}${cut('bottom')}H${f1(x + r)}${arc(x, bottom - r)}${cut('left')}V${f1(y + r)}${arc(x + r, y)}Z`;
  return {d, ...(wedge ? {base: [[f1(wedge.base[0][0]), f1(wedge.base[0][1])], [f1(wedge.base[1][0]), f1(wedge.base[1][1])]] as [[number, number], [number, number]]} : {})};
}
