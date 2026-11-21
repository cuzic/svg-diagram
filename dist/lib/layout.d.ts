import type { DiagramData, Roles, WidthOf } from './types/core.ts';
import type { LaidOutDiagram } from './types/index.ts';
/** Pass 2, synchronous: lay the diagram out with the widths already measured. */
export declare function layoutWith(data: DiagramData, roles: Roles, widthOf: WidthOf): LaidOutDiagram;
/**
 * ADR 0070 D7 (U5): on a canvas, the cause bands' lines scale with the text and make the figure taller. When that is what pushes the whole figure (the bands above and below
 * the cause band, the legend, the source line and the padding included) over the canvas height, and the old lines would fit, the figure is laid out again with the old lines.
 * The cause bands are dropped one more at a time in the order they are laid out (top to bottom) until the figure fits; if it never fits, the first layout is kept
 * (the overflow is then not the scale's, and `slide-canvas-overflow` says it). A dropped band is `lineScaleDropped` (the `cause-line-scale-dropped` finding).
 */
export declare function fitLineScale(data: DiagramData, layout: (lines: {
    seen: number;
    drop: number;
    exchange: boolean;
    taller: boolean;
}) => LaidOutDiagram): LaidOutDiagram;
