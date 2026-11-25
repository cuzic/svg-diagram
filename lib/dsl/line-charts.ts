import {burndownOpts, burnupOpts, linesOpts, strategyCanvasOpts} from '../charts-lines.ts';
import type {BurndownSpec, BurnupSpec, LineSeries, LinesOpts, StrategyCanvasOpts} from '../charts-lines.ts';
import type {PlaneBand} from '../types/figures.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {plane} from './plane.ts';

/**
 * A multi-series line chart (折れ線グラフ), made on plane(): categories (`x: {categories}`, one value per category, null for a gap) or numbers
 * ([x, y] pairs) along x; each series has a marker shape and a line style of its own and is named at the end of its line; `target` draws
 * a goal line; `annotate` rings and names points. `ideal: true` makes a series the dashed plan line. Kano-model curves: [x, y] pairs with `smooth`.
 *   lines([{label: '自社', values: [3, 4, 5]}, {label: '競合', values: [5, 3, 2]}], {x: {categories: ['価格', '品質', '速さ']}, y: {min: 0, max: 5}})
 */
export function lines<const Id extends string = never>(series: readonly LineSeries[], opts?: LinesOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function lines(series: readonly LineSeries[], opts: LinesOpts = {}): PlaneBand {
  return plane(linesOpts(series, opts)) as PlaneBand;
}
/** A strategy canvas (戦略キャンバス): factors of competition on x, the level offered (low to high) on y, one line per company. */
export function strategyCanvas<const Id extends string = never>(factors: readonly string[], series: readonly {label: string; values: readonly number[]}[], opts?: StrategyCanvasOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function strategyCanvas(factors: readonly string[], series: readonly {label: string; values: readonly number[]}[], opts: StrategyCanvasOpts = {}): PlaneBand {
  return lines(...strategyCanvasOpts(factors, series, opts));
}
/** A burndown chart (バーンダウン): the work left day by day against the ideal line. `actual` runs from day 0; null for days not yet reached. */
export function burndown<const Id extends string = never>(spec: BurndownSpec, opts?: LinesOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function burndown(spec: BurndownSpec, opts: LinesOpts = {}): PlaneBand {
  return lines(...burndownOpts(spec, opts));
}
/** A burnup chart (バーンアップ): the work done climbing towards the scope line, which may move. */
export function burnup<const Id extends string = never>(spec: BurnupSpec, opts?: LinesOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function burnup(spec: BurnupSpec, opts: LinesOpts = {}): PlaneBand {
  return lines(...burnupOpts(spec, opts));
}
