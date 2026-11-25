import type { TrackPlace } from './types/containers.ts';
/** The most columns / rows a template may have. */
export declare const AREAS_MAX_TRACKS = 12;
export interface AreaTemplate {
    cols: number;
    rows: number;
    /** The names in the order they first appear (row by row, left to right). */
    names: string[];
    /** Where each name sits. */
    place: Map<string, TrackPlace>;
}
/**
 * Reads a template: a string (rows split by newlines; blank lines at the start and the end and the indentation dropped) or an array of
 * row strings. Throws, naming the row (and column), when a row is blank, the rows have different numbers of cells, a cell is not a
 * name or `.`, a full-width space is used, a row is all `.`, a name is not a rectangle, or there are more than 12 columns / rows.
 */
export declare function parseAreaTemplate(template: string | readonly string[]): AreaTemplate;
/**
 * The x and width of every column of an areas() `cw` wide whose left edge is `x0` (on the 4px grid): every width is a whole number of
 * 4px steps shared out by the ratios, and columns of the same ratio are exactly as wide (an equal split looks equal, never 184 / 180 /
 * 184px: the layout-sibling-size rule would flag it). The steps the ratios leave over widen the gutters when every gutter can take
 * the same number of them; what is left after that (fewer steps than gutters) stays unused at the right.
 */
export declare function areasColumns(colW: readonly number[], x0: number, cw: number, gap: number): {
    x: number[];
    w: number[];
};
