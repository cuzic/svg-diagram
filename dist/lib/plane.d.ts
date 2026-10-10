import type { FontFamily, LaidOutPlane, PlaneBand, WidthOf } from './types.ts';
/** Every [text, size, weight, font] the plane draws, so the measurer knows them before layout. */
export declare function planeTexts(band: PlaneBand): [string, number, number, FontFamily][];
export declare function layoutPlane(band: PlaneBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutPlane;
