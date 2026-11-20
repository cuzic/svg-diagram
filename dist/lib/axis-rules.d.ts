import type { Band } from './types/index.ts';
export interface ValueAxis {
    label: string;
    unit: string; /** the value axis runs up the page (bars rise), else along it (bars run sideways) */
    vertical: boolean;
    min: number;
    max: number;
    own: boolean;
}
/** The value axis a chart band is drawn with, for the kinds that have one that is read as a length from zero. */
export declare function valueAxisOf(b: Band): ValueAxis | undefined;
/**
 * The pairs whose axes are read against each other (ADR 0029 D5): (1) charts in different groups of one `grouprow` (side by side: a reader compares heights),
 * with the value axis up the page; (2) charts that follow one another in the same list with no other chart between them (one under the other: a reader
 * compares lengths), with the value axis along the page. Always the same unit, neither marked `axisGroup: false`.
 */
export declare function axisMismatches(bands: readonly Band[]): string[];
