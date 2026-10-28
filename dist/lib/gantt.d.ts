import type { FontFamily, Roles, WidthOf } from './types/core.ts';
import type { GanttBand, GanttTask, LaidOutGantt } from './types/timeline.ts';
/** [start, end) of a task in days; a milestone is the one day `start`. */
export declare function spanOf(t: GanttTask): [number, number];
export declare function ganttTexts(band: GanttBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutGantt(band: GanttBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutGantt;
