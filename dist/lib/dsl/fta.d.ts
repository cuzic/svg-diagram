import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { FtaBand, FtaEvent, FtaOpts } from '../types/diagrams.ts';
/** The ids of a fault tree's events: its own, and those of every input and every inhibit condition below it. */
type FtaIds<T> = (T extends {
    readonly id: infer I extends string;
} ? I : never) | (T extends {
    readonly children: readonly (infer C)[];
} ? FtaIds<C> : never) | (T extends {
    readonly condition: infer C;
} ? FtaIds<C> : never);
/**
 * A fault tree (FTA): the top event, a gate under it (and / or / vote with k / inhibit) and the events that cause it, down to basic events (circle),
 * undeveloped events (diamond) and house events. Each event's text is a rectangle with the symbol of its kind under it; `{ref: id}` draws a
 * basic / undeveloped / house / condition event again. The lines have no arrowheads (they join a gate to its inputs: the tree reads downward).
 *   faultTree({label: 'サービス停止', gate: 'or', children: [
 *     {label: 'DB 全体停止', gate: 'and', children: [{label: '主系停止', kind: 'basic'}, {id: 'sw', label: '待機系へ切替不能', kind: 'basic'}]},
 *     {label: 'アプリ全台停止', kind: 'undeveloped'}]})
 */
export declare function faultTree<const T extends FtaEvent, const Id extends string = never>(top: T, opts?: FtaOpts & {
    id?: Id;
}): FtaBand & Declares<Id | FtaIds<T>> & HandleOf<Id> & AnchorsOf<FtaIds<T>>;
export {};
