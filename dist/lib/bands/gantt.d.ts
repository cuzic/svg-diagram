import type { BandDef, WithBandDef } from '../band-def.ts';
import { gantt as buildGantt } from '../dsl/gantt.ts';
import type { GanttBand, GanttOpts, GanttRow, LaidOutGantt } from '../types/timeline.ts';
export declare function gantt<const R extends readonly GanttRow[], const Id extends string = never>(rows: R, opts?: GanttOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildGantt<R, Id>>, LaidOutGantt>;
/** @internal Definition used by the full renderer. */
export declare const ganttDefinition: BandDef<GanttBand, LaidOutGantt>;
