import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { CloudBand, CloudBox, CloudOpts } from '../types/diagrams.ts';
type CloudIds<B> = B extends {
    id: infer I extends string;
} ? I : never;
/**
 * An Evaporating Cloud (conflict resolution diagram): A the common objective on the left, B and C the two needs, D and D' the two
 * wants that conflict (the red zigzag). Each arrow reads "in order to ..., we must ...". `assumptions` are numbered in the order
 * written, the number sits on the arrow they belong to (`on`: ab, ac, bd, cd, or dd for the conflict itself), and the list is under
 * the figure; an `injection` is the change that makes the assumption false.
 *   cloud({a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする'},
 *         {assumptions: [{on: 'bd', text: '品質確保には長い検証期間が必須', injection: '自動テストで検証を短縮する'}]})
 */
export declare function cloud<const A extends CloudBox, const B extends CloudBox, const C extends CloudBox, const D extends CloudBox, const D2 extends CloudBox, const Id extends string = never>(boxes: {
    a: A;
    b: B;
    c: C;
    d: D;
    d2: D2;
}, opts?: CloudOpts & {
    id?: Id;
}): CloudBand & Declares<Id | CloudIds<A> | CloudIds<B> | CloudIds<C> | CloudIds<D> | CloudIds<D2>> & HandleOf<Id> & AnchorsOf<CloudIds<A> | CloudIds<B> | CloudIds<C> | CloudIds<D> | CloudIds<D2>>;
export {};
