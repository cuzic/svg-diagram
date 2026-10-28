import type { FontFamily, WidthOf, Roles } from './types/core.ts';
import type { LaidOutPlane, PlaneBand } from './types/figures.ts';
/** Every [text, size, weight, font] the plane draws, so the measurer knows them before layout. */
export declare function planeTexts(band: PlaneBand, roles: Roles): [string, number, number, FontFamily][];
export declare const fmt: (n: number) => string;
export declare function ticksOf(axis: PlaneBand['x'], caller?: string): {
    at: number;
    label: string;
}[];
export declare function layoutPlane(band: PlaneBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutPlane;
