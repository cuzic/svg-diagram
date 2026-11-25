import type { CanvasLayout, TrackGrid } from './types/containers.ts';
/** The least height of a region that is meant to be filled (fit 'content'): a row never collapses to its title and one line. Label cells and optional regions left empty have no floor. */
export declare const CANVAS_MIN_ROW_H = 96;
/**
 * The x and width of every column of a canvas `cw` wide whose left edge is `x0`. Column starts are on the 4px grid the emitter snaps
 * shapes to (gap is a multiple of 4), so the gutters are all `gap` wide and a region spanning columns lines up with the ones it spans.
 */
export declare function canvasColumns(c: CanvasLayout, x0: number, cw: number, gap: number): {
    x: number[];
    w: number[];
};
/** The left edge and width of the cell `p` covers. */
export declare function canvasSpan(cols: {
    x: number[];
    w: number[];
}, p: {
    col: number;
    cs: number;
}): {
    x: number;
    w: number;
};
/**
 * The height of every row, from what each cell needs: a row is as tall as its tallest single-row cell; a cell spanning rows that needs more
 * than they give widens them equally; and the whole is at least `minTotal`, shared by the rows' weights (a row that needs more keeps it).
 */
export declare function canvasRowHeights(c: TrackGrid, needs: readonly number[], gap: number, minTotal: number): number[];
/**
 * The top of every row and the bottom of the last one plus `gap` (n + 1 values): each row's height is rounded up to the 4px grid, so
 * with `top` and `gap` on the grid every row edge is too. A cell of rows r..r+k-1 runs from ys[r] to ys[r + k] - gap.
 */
export declare function trackRowYs(top: number, rows: readonly number[], gap: number): number[];
