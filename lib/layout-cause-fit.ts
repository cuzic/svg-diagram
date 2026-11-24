import type {LayoutCtx} from './layout-ctx.ts';
import type {DiagramData} from './types/core.ts';

/**
 * ADR 0070 D7 (U5): on a canvas, the cause bands' lines scale with the text and make the figure taller. When that is what pushes the whole figure (the bands above and below
 * the cause band, the legend, the source line and the padding included) over the canvas height, and the old lines would fit, the figure is laid out again with the old lines.
 * The cause bands are dropped one more at a time in the order they are laid out (top to bottom) until the figure fits; if it never fits, the first layout is kept
 * (the overflow is then not the scale's, and `slide-canvas-overflow` says it). A dropped band is `lineScaleDropped` (the `cause-line-scale-dropped` finding).
 */
export function fitLineScale<T extends {contentHeight?: number}>(data: DiagramData, layout: (lines: LayoutCtx['lines']) => T): T {
  const first = {seen: 0, drop: 0, exchange: true, taller: false}, out = layout(first);
  if (!data.canvas || out.contentHeight === undefined || out.contentHeight <= data.canvas.height) return out;
  // ADR 0073 D1 (g): when a band took a taller order (they cross less), the figure that overflows is laid out again without that, with the scaled lines, before any line scale is dropped
  // (so a taller order never costs a band its scale), then the bands are dropped one at a time (with no taller orders either). With no taller order the first layout is that layout: no retry (2).
  // If nothing fits, the figure is the first one laid without taller orders (the one main keeps), not the taller one.
  let fallback: T | undefined;
  for (let drop = first.taller ? 0 : 1; drop <= first.seen; drop++) {
    let again: T;
    try { again = layout({seen: 0, drop, exchange: false, taller: false}); } catch { return fallback ?? out; } // a retry that cannot be laid out keeps the figure that was (the retry never turns a drawn figure into an error)
    if (again.contentHeight !== undefined && again.contentHeight <= data.canvas.height) return again;
    if (drop === 0) fallback = again;
  }
  return fallback ?? out;
}
