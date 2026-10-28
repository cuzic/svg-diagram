import type { Band } from './types/index.ts';
/** 'YYYY-MM-DD' of a real date, else a message that names where the value came from. */
export declare function checkToday(v: unknown, what: string): string;
/** Writes `today` into every gantt that says 'auto'. Returns whether there was one (the date then goes in the SVG's metadata). */
export declare function fillAutoToday(bands: Band[], today: string | undefined): boolean;
