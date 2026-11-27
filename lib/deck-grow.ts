// ADR 0085 D2 (U2): the deck draws a figure a second time with larger labels when its first drawing, scaled onto the slide, came out under the
// size of the slide's own text. Only the parts that have a fit test (lib/flow-grow.ts) take part; the deck asks with a `textSize` it hands down with the layout width.

/** The size (px) a figure's smallest text should come to on the slide: the figure's usual 14px text at the largest scale (1.5, ADR 0060 D2). */
export const TARGET_EFFECTIVE_PX = 21;
/** The size a part draws its labels at without being asked for more. */
const USUAL_PX = 14;
/** The parts with a fit test for larger labels. */
const GROWN_PARTS: ReadonlySet<string> = new Set(['concentric', 'venn', 'cycle']);

/** What a deck asks of these parts at figure scale `k`: `floor(21 / k)`, or undefined when 14px text already comes out at 21px or more. */
export const askedTextSize = (k: number): number | undefined => {
  const size = Math.floor(TARGET_EFFECTIVE_PX / k + 1e-9);
  return size > USUAL_PX ? size : undefined;
};

/** Whether a spec has a part that can use larger labels (no other figure is drawn a second time). */
export function growsText(spec: unknown): boolean {
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) return false;
  const parts = (spec as {parts?: unknown}).parts;
  return Array.isArray(parts) && parts.some((p: unknown) => {
    const kind = typeof p === 'object' && p !== null ? (p as {type?: unknown})['type'] : undefined;
    return typeof kind === 'string' && GROWN_PARTS.has(kind);
  });
}

/**
 * `first`, a figure drawn at its usual text size and placed in `room` (no larger than `cap` times), or the same figure drawn again with the
 * labels `redraw` is given the size of when that makes the text larger on the slide and the figure is not scaled down more for it. `redraw` returns
 * null when the second drawing is not acceptable (an error, a new problem).
 */
export async function growFigure<R extends {w: number; h: number}>(spec: unknown, first: R, room: {w: number; h: number} | null, cap: number, redraw: (size: number) => Promise<R | null>): Promise<R> {
  if (!room) return first;
  const scaleOf = (f: R): number => Math.min(room.w / f.w, room.h / f.h, cap);
  const k = scaleOf(first), size = askedTextSize(k);
  if (size === undefined || !growsText(spec)) return first;
  const again = await redraw(size);
  return again && scaleOf(again) >= k - 1e-6 ? again : first;
}
