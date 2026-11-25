import type { DiagramData, Rect } from './types/core.ts';
import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
/** Lay out again at the width the content needs. Allow up to three rounds as it reflows, keeping the previous layout if a round does not fit. */
export declare function layoutFitted(d: DiagramData, layout: () => LaidOutDiagram | Promise<LaidOutDiagram>): Promise<LaidOutDiagram>;
/** Everything the figure shows, as one rect (labels of shapes included). Captions (titles and the source line), the status strip and legends are furniture, not the figure. */
export declare function contentBox(laidOut: LaidOutBand[], tight?: boolean): Rect | null;
