import type { LaidOutDiagram } from './types/index.ts';
import type { FitReport } from './types/verdicts.ts';
export declare const SLIDE_USABLE_WIDTH = 860;
/** The smallest text size (px, in the SVG's own units) the diagram draws. */
export declare function minTextSize(d: {
    laidOut?: LaidOutDiagram['laidOut'];
    connects?: LaidOutDiagram['connects'];
    roles?: LaidOutDiagram['roles'];
}): number;
export declare function analyzeFit(d: LaidOutDiagram): FitReport;
