import type { HarveyCell, HarveyOpts, HarveyRow } from '../charts-harvey.ts';
import type { ChartBand } from '../charts.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
export declare function harveyBand(rows: readonly HarveyRow[], cols: readonly string[], values: readonly (readonly HarveyCell[])[], opts: HarveyOpts): ChartBand;
type HarveyIds<R extends readonly HarveyRow[]> = R[number] extends infer E ? E extends {
    id: infer I extends string;
} ? I : never : never;
/**
 * A table of Harvey balls (ハーベイボール): each cell is a circle filled 0–4 quarters (null: not rated), rows are criteria, columns are options.
 * A cell written [quarters, note] gets its reason beside the ball, split by a dashed line.
 *   harvey(['価格', '品質'], ['A 社', 'B 社'], [[4, 2], [1, 3]], {highlight: ['A 社']})
 */
export declare function harvey<const R extends readonly HarveyRow[], const Id extends string = never>(rows: R, cols: readonly string[], values: readonly (readonly HarveyCell[])[], opts?: HarveyOpts & {
    id?: Id;
}): ChartBand & Declares<Id | HarveyIds<R>> & HandleOf<Id> & AnchorsOf<HarveyIds<R>>;
export {};
