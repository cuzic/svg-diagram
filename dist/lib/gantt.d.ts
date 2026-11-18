import type { FontFamily, Roles, WidthOf } from './types/core.ts';
import type { GanttBand, GanttTask, LaidOutGantt } from './types/timeline.ts';
/** [start, end) of a task in days; a milestone is the one day `start`. */
export declare function spanOf(t: GanttTask): [number, number];
export declare function ganttTexts(band: GanttBand, roles: Roles): [string, number, number, FontFamily][];
/** `geom` multiplies the row, bar and header heights and the padding: 1 keeps them at their 14px values; a canvas passes its font scale, so the header holds both the tick dates and today's label. */
export declare function layoutGantt(band: GanttBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, geom?: number): LaidOutGantt;
