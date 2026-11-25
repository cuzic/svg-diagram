import { Canvas } from './charts-base.ts';
import type { ChartGeom, LaidOutChartPart } from './charts-base.ts';
/** A rated cell (the note is drawn only in a ruled table), or null for a cell that is not rated (drawn as a dash). */
export type RatedCell<T> = {
    rating: T;
    note?: string;
} | null;
export interface RatingTable<T> {
    rows: string[];
    rowIds?: (string | undefined)[];
    cols: string[];
    cells: RatedCell<T>[][];
    corner: string;
    highlight?: string[];
    /** Tinted header, lines between the columns, and each cell split into its rating and its note. */
    ruled: boolean;
}
export interface RatingLook<T> {
    who: string;
    /** The room a rating takes: its column in a ruled table, and the narrowest a column may be in the others. */
    ratingW: number;
    ratingH: number;
    draw(c: Canvas, cx: number, cy: number, rating: T, of: string): void;
    /** What goes under the table (a legend). */
    foot?: {
        h: number;
        draw(c: Canvas, tableBottom: number): void;
    };
}
export declare function layoutRatingTable<T>(t: RatingTable<T>, look: RatingLook<T>, g: ChartGeom): LaidOutChartPart;
