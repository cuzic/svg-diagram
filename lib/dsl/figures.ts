import {quadrantBand} from '../quadrant.ts';
import type {QuadrantBand, QuadrantItem, QuadrantOpts, QuadrantPreset} from '../quadrant.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {withHandle} from './shared.ts';

export {pyramid} from './pyramid.ts';
export {curve} from './curve.ts';

export {plane} from './plane.ts';
type QuadrantItemIds<I extends readonly {id?: string}[]> = I[number] extends infer E ? (E extends {readonly id: infer X extends string} ? X : never) : never;
type QuadrantExtra<Id extends string, I extends readonly {id?: string}[]> = QuadrantBand & Declares<Id | QuadrantItemIds<I>> & HandleOf<Id>;
interface QuadrantFn {
  <const Id extends string = never, const I extends readonly QuadrantItem[] = readonly []>(opts: Omit<QuadrantOpts, 'items'> & {id?: Id; items?: I}): QuadrantExtra<Id, I>;
  /** quadrant({preset: name, ...opts}): the axes, captions and tones of a named framework — 'bcg' | 'ge' | 'ansoff' | 'nineBox' | 'impactEffort' | 'risk' | 'stakeholder' | 'positioning' | 'eisenhower'. */
  preset<const Id extends string = never, const I extends readonly QuadrantItem[] = readonly []>(name: QuadrantPreset, opts?: Omit<QuadrantOpts, 'items' | 'preset'> & {id?: Id; items?: I}): QuadrantExtra<Id, I>;
}
/**
 * A classification matrix (2x2, 3x3 or any N x M) between two axes: cells with a caption, items placed in a cell or at coordinates,
 * optional bubble sizes (area proportional to the value, with a legend), movement arrows. Every item with an id is an anchor for
 * connect() / spotlight; items never overlap each other, a label or a caption (they move within their cell, or the rows grow).
 *   quadrant({preset: 'bcg', sizeTitle: '売上', sizeUnit: '億円', items: [{id: 'a', label: '製品 A', at: [0.8, 0.9], size: 120}, {label: '製品 B', cell: [1, 0]}]})
 *   quadrant({x: {title: '価格', low: '安い', high: '高い'}, y: {title: '品質', low: '低い', high: '高い'}, crosshair: true, items: [...]})
 * Item `at` is in value space ([1, 1] = high on both axes, whichever way the axis is drawn); `cell` is [col, row] from the top-left as drawn.
 */
export const quadrant: QuadrantFn = Object.assign(
  (opts: QuadrantOpts): QuadrantBand => withHandle(quadrantBand(opts), opts?.id),
  {preset: (name: QuadrantPreset, opts: Omit<QuadrantOpts, 'preset'> = {}): QuadrantBand => withHandle(quadrantBand({...opts, preset: name}), opts.id)},
) as QuadrantFn;
export {chevron, concentric, cycle, emblem, funnel, valueChain, venn} from './flow.ts';
export {wordart} from './wordart.ts';
