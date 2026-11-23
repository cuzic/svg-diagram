// Track geometry shared by canvas() and areas().
import {must} from './must.ts';
import type {CanvasLayout, TrackGrid} from './types/containers.ts';

/** The least height of a region that is meant to be filled (fit 'content'): a row never collapses to its title and one line. Label cells and optional regions left empty have no floor. */
export const CANVAS_MIN_ROW_H = 96;

// ---- geometry (pure; canvasSpan / canvasRowHeights / trackRowYs are shared with areas(), which has its own columns: areasColumns) -----------------------------------------------------------------------------------------------------------

/**
 * The x and width of every column of a canvas `cw` wide whose left edge is `x0`. Column starts are on the 4px grid the emitter snaps
 * shapes to (gap is a multiple of 4), so the gutters are all `gap` wide and a region spanning columns lines up with the ones it spans.
 */
export function canvasColumns(c: CanvasLayout, x0: number, cw: number, gap: number): {x: number[]; w: number[]} {
  const total = c.colW.reduce((a, b) => a + b, 0), room = cw - gap * (c.colW.length - 1), n = c.colW.length;
  const x: number[] = [];
  let at = x0;
  c.colW.forEach((v, i) => { x.push(i === 0 ? x0 : Math.round(at / 4) * 4); at += room * v / total + gap; });
  const w = x.map((v, i) => (i + 1 < n ? must(x[i + 1]) - gap : x0 + cw) - v);
  return {x, w};
}
/** The left edge and width of the cell `p` covers. */
export function canvasSpan(cols: {x: number[]; w: number[]}, p: {col: number; cs: number}): {x: number; w: number} {
  const last = p.col + p.cs - 1;
  return {x: must(cols.x[p.col]), w: must(cols.x[last]) + must(cols.w[last]) - must(cols.x[p.col])};
}

/**
 * The height of every row, from what each cell needs: a row is as tall as its tallest single-row cell; a cell spanning rows that needs more
 * than they give widens them equally; and the whole is at least `minTotal`, shared by the rows' weights (a row that needs more keeps it).
 */
export function canvasRowHeights(c: TrackGrid, needs: readonly number[], gap: number, minTotal: number): number[] {
  const n = c.rowW.length, rows = new Array<number>(n).fill(0);
  const cells = c.place.map((p, i) => ({...p, need: needs[i] ?? 0}));
  for (const k of [...new Set(cells.map(p => p.rs))].sort((a, b) => a - b)) {
    for (const p of cells.filter(q => q.rs === k)) {
      const have = rows.slice(p.row, p.row + k).reduce((a, b) => a + b, 0) + gap * (k - 1);
      if (p.need > have) for (let r = p.row; r < p.row + k; r++) rows[r] = must(rows[r]) + (p.need - have) / k;
    }
  }
  const room = minTotal - gap * (n - 1), fixed = new Set<number>();
  for (let guard = 0; guard < n + 1; guard++) {
    const free = [...rows.keys()].filter(r => !fixed.has(r)), left = room - [...fixed].reduce((a, r) => a + must(rows[r]), 0), fw = free.reduce((a, r) => a + must(c.rowW[r]), 0);
    if (!free.length || left <= 0) break;
    const over = free.find(r => must(rows[r]) > left * must(c.rowW[r]) / fw);
    if (over === undefined) { for (const r of free) rows[r] = Math.max(must(rows[r]), left * must(c.rowW[r]) / fw); break; }
    fixed.add(over);
  }
  return rows;
}

/**
 * The top of every row and the bottom of the last one plus `gap` (n + 1 values): each row's height is rounded up to the 4px grid, so
 * with `top` and `gap` on the grid every row edge is too. A cell of rows r..r+k-1 runs from ys[r] to ys[r + k] - gap.
 */
export function trackRowYs(top: number, rows: readonly number[], gap: number): number[] {
  const ys = [top];
  rows.forEach((v, r) => ys.push(must(ys[r]) + Math.ceil(v / 4 - 1e-6) * 4 + gap));
  return ys;
}
