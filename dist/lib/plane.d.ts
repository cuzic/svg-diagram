import type { FontFamily, WidthOf, Roles } from './types/core.ts';
import type { LaidOutPlane, PlaneBand } from './types/figures.ts';
/** Every [text, size, weight, font] the plane draws, so the measurer knows them before layout. */
export declare function planeTexts(band: PlaneBand, roles: Roles): [string, number, number, FontFamily][];
/** The n + 1 edges of n stage columns, in axis units: equal widths, or where each column says it ends. */
export declare function stageEdges(stages: NonNullable<PlaneBand['stages']>, min: number, max: number): number[];
export declare const fmt: (n: number) => string;
export declare function ticksOf(axis: PlaneBand['x'], caller?: string): {
    at: number;
    label: string;
}[];
/** `geom`: a canvas's font scale (1 off a canvas), which the height and the offsets of the labels (written in px for 14px text) are multiplied by. */
export declare function layoutPlane(band: PlaneBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, geom?: number): LaidOutPlane;
