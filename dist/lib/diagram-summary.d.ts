import type { DiagramData } from './types/core.ts';
export declare function diagramTitle(d: DiagramData): string;
/** `stage`: a click stage of a revealing diagram; only what is on screen then is listed (nothing is left out without it). */
export declare function diagramDesc(d: DiagramData, stage?: number): string;
