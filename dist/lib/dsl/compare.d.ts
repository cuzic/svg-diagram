import type { CompareCell, CompareOpts } from '../charts-compare.ts';
import type { ChartBand } from '../charts.ts';
import type { Declares, HandleOf } from '../strict.ts';
export declare function compareBand(rows: readonly string[], cols: readonly string[], cells: readonly (readonly CompareCell[])[], opts: CompareOpts): ChartBand;
/**
 * A comparison table (比較表): rows are criteria, columns are options, and each cell is a rating and its reason, split by a dashed line with the rating centred.
 * A cell is [mark, note] (mark: ◎ ○ △ × or best / ok / mid / ng), or null when it is not rated.
 *   compare(['コスト', '拡張性'], ['案A', '案B'], [[['○', '既存設備を流用'], ['×', '初期投資が大きい']], [['△', '一部のみ'], ['○', '自由に拡張']]], {corner: '比較軸'})
 */
export declare function compare<const Id extends string = never>(rows: readonly string[], cols: readonly string[], cells: readonly (readonly CompareCell[])[], opts?: CompareOpts & {
    id?: Id;
}): ChartBand & Declares<Id> & HandleOf<Id>;
