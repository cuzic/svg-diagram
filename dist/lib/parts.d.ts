import type { LaidOutDiagram } from './types/index.ts';
export interface PartStep {
    kind: string;
    key: string;
    label: string; /** The key is an index (the part has no DSL id). */
    index: boolean;
}
/** One step of a part's path. `key` is a DSL id, or an index (written `#3`) when the part has no id; a `#` in an id is escaped, so only an index starts with one. */
export declare const partStep: (kind: string, key: string | number | {
    index: string;
}, label: string) => string;
/** A chart's axis (its grid lines, ticks, tick texts and name): `which` is x, y, or y2 for a second value axis. */
export declare const axisPart: (which: string) => string;
/** A chart's legend (its entries are parts inside it: partStep('entry', …)). */
export declare const LEGEND: string;
/** A plane's axes, their ticks and their names: one part (lib/plane.ts). */
export declare const PLANE_AXES: string;
/** The crosshair and axis texts of a quadrant form one part. */
export declare const QUADRANT_AXES: string;
/** A Gantt chart's date axis: its line, ticks and dates (lib/gantt.ts). */
export declare const GANTT_AXIS: string;
/** A timeline's axis: its line, ticks and dates (lib/timeline.ts). */
export declare const TIMELINE_AXIS: string;
/** ` data-part="…"` when `on` (the band was drawn with parts), else nothing. */
export declare const partAttr: (on: boolean | undefined, ...steps: string[]) => string;
/** `svg` (one or more drawn elements) with `attr` (from partAttr) on each drawn element: for a helper that draws a piece of a part. */
export declare const marked: (svg: string, attr: string) => string;
/** Whether a band is drawn with its parts marked. Any band may carry the flag, so this reads it without widening every band type. */
export declare const partsOn: (band: object) => boolean;
/** A `data-part` value as its steps. */
export declare function parsePart(value: string): PartStep[];
/** The laid-out diagram with every band marked to draw its parts. */
export declare const withParts: (d: LaidOutDiagram) => LaidOutDiagram;
