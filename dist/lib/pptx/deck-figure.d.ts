import type { LaidOutDiagram } from '../types/index.ts';
/** A figure's smallest text in pt at scale 1, counted as the .pptx counts it (null without text). */
export declare function figureMinPt(laidOut: LaidOutDiagram): number | null;
