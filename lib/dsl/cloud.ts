import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import type {CloudBand, CloudBox, CloudOpts} from '../types/diagrams.ts';
import {revealOf, scopeOpt, withAnchors, withHandle} from './shared.ts';

type CloudIds<B> = B extends {id: infer I extends string} ? I : never;
/**
 * An Evaporating Cloud (conflict resolution diagram): A the common objective on the left, B and C the two needs, D and D' the two
 * wants that conflict (the red zigzag). Each arrow reads "in order to ..., we must ...". `assumptions` are numbered in the order
 * written, the number sits on the arrow they belong to (`on`: ab, ac, bd, cd, or dd for the conflict itself), and the list is under
 * the figure; an `injection` is the change that makes the assumption false.
 *   cloud({a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする'},
 *         {assumptions: [{on: 'bd', text: '品質確保には長い検証期間が必須', injection: '自動テストで検証を短縮する'}]})
 */
export function cloud<const A extends CloudBox, const B extends CloudBox, const C extends CloudBox, const D extends CloudBox, const D2 extends CloudBox, const Id extends string = never>(boxes: {a: A; b: B; c: C; d: D; d2: D2}, opts?: CloudOpts & {id?: Id}): CloudBand & Declares<Id | CloudIds<A> | CloudIds<B> | CloudIds<C> | CloudIds<D> | CloudIds<D2>> & HandleOf<Id> & AnchorsOf<CloudIds<A> | CloudIds<B> | CloudIds<C> | CloudIds<D> | CloudIds<D2>>;
export function cloud(boxes: {a: CloudBox; b: CloudBox; c: CloudBox; d: CloudBox; d2: CloudBox}, opts: CloudOpts = {}): CloudBand {
  for (const k of ['a', 'b', 'c', 'd', 'd2'] as const) if (boxes?.[k] == null) throw new Error(`cloud({a, b, c, d, d2}): box ${k} is missing`);
  if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 120 && Number.isFinite(opts.maxNodeW))) throw new Error(`cloud(): maxNodeW must be a number >= 120 (got ${opts.maxNodeW})`);
  for (const k of ['a', 'b', 'c', 'd', 'd2'] as const) {
    const t = typeof boxes[k] === 'string' ? undefined : (boxes[k] as {tone?: string}).tone;
    if (t !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(t)) throw new Error(`cloud(): box ${k} has tone ${String(t)}`);
  }
  const band: CloudBand = {type: 'cloud', a: boxes.a, b: boxes.b, c: boxes.c, d: boxes.d, d2: boxes.d2, ...(opts.assumptions === undefined ? {} : {assumptions: opts.assumptions.map(a => ({...a}))}), ...(opts.separator === undefined ? {} : {separator: opts.separator}), ...(opts.conflictLabel === undefined ? {} : {conflictLabel: opts.conflictLabel}), ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.id === undefined ? {} : {id: opts.id}), ...scopeOpt(opts, 'cloud()'), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), (['a', 'b', 'c', 'd', 'd2'] as const).map(k => { const v = boxes[k]; return typeof v === 'string' ? undefined : v.id; }));
}
