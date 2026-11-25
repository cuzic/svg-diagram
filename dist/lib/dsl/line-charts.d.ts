import type { BurndownSpec, BurnupSpec, LineSeries, LinesOpts, StrategyCanvasOpts } from '../charts-lines.ts';
import type { PlaneBand } from '../types/figures.ts';
import type { Declares, HandleOf } from '../strict.ts';
/**
 * A multi-series line chart (折れ線グラフ), made on plane(): categories (`x: {categories}`, one value per category, null for a gap) or numbers
 * ([x, y] pairs) along x; each series has a marker shape and a line style of its own and is named at the end of its line; `target` draws
 * a goal line; `annotate` rings and names points. `ideal: true` makes a series the dashed plan line. Kano-model curves: [x, y] pairs with `smooth`.
 *   lines([{label: '自社', values: [3, 4, 5]}, {label: '競合', values: [5, 3, 2]}], {x: {categories: ['価格', '品質', '速さ']}, y: {min: 0, max: 5}})
 */
export declare function lines<const Id extends string = never>(series: readonly LineSeries[], opts?: LinesOpts & {
    id?: Id;
}): PlaneBand & Declares<Id> & HandleOf<Id>;
/** A strategy canvas (戦略キャンバス): factors of competition on x, the level offered (low to high) on y, one line per company. */
export declare function strategyCanvas<const Id extends string = never>(factors: readonly string[], series: readonly {
    label: string;
    values: readonly number[];
}[], opts?: StrategyCanvasOpts & {
    id?: Id;
}): PlaneBand & Declares<Id> & HandleOf<Id>;
/** A burndown chart (バーンダウン): the work left day by day against the ideal line. `actual` runs from day 0; null for days not yet reached. */
export declare function burndown<const Id extends string = never>(spec: BurndownSpec, opts?: LinesOpts & {
    id?: Id;
}): PlaneBand & Declares<Id> & HandleOf<Id>;
/** A burnup chart (バーンアップ): the work done climbing towards the scope line, which may move. */
export declare function burnup<const Id extends string = never>(spec: BurnupSpec, opts?: LinesOpts & {
    id?: Id;
}): PlaneBand & Declares<Id> & HandleOf<Id>;
