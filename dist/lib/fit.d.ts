import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
import type { FitReport } from './types/verdicts.ts';
export declare const SLIDE_USABLE_WIDTH = 860;
export declare const SLIDE_MAX_DISPLAY_HEIGHT = 300;
type BandTextSizes = (band: LaidOutBand) => Iterable<number>;
/** The smallest text size (px, in the SVG's own units) the diagram draws. */
export declare function minTextSize(d: {
    laidOut?: LaidOutDiagram['laidOut'];
    connects?: LaidOutDiagram['connects'];
    roles?: LaidOutDiagram['roles'];
}, textSizes: BandTextSizes): number;
/** Documents and fixed canvases are displayed at their drawn size. */
export declare function analyzeDocumentFit(d: LaidOutDiagram, textSizes: BandTextSizes): FitReport;
export declare function analyzeFit(d: LaidOutDiagram, textSizes: BandTextSizes): FitReport;
export {};
