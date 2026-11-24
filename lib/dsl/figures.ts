import {quadrantBand} from '../quadrant.ts';
import type {QuadrantBand, QuadrantItem, QuadrantOpts, QuadrantPreset} from '../quadrant.ts';
import {LABEL_ROLES} from '../tokens.ts';
import type {PlaneBand, PlaneOpts} from '../types/figures.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {assertTextRole, withHandle} from './shared.ts';

export {pyramid} from './pyramid.ts';
export {curve} from './curve.ts';

// A coordinate plane: axes with ticks, points, guide lines, dimension lines and labels, all in the plane's own units.
//   plane({x: {label: 'x', max: 100, step: 20}, y: {label: 'y', max: 60}, yDown?: true (image coordinates), grid?: true,
//          points: [{id: 'a', at: [20, 10], label: 'A', labelAt?, tone?, shape?: 'dot' | 'ring' | 'cross'}],
//          stages?: ['起源', 'カスタム', ...] or [{name, to: x}, ...] (named x columns with dividers; Wardley map), points[].evolves?: {to: x} (ring + dashed arrow),
//          lines:  [{from: 'a', to: [20, 0], tone?, dashed? (default true), arrow?}],       // guides / projections
//          dims:   [{from: 'a', to: 'b', label: '40 m', side?: 'above' | 'below' | 'left' | 'right', tone?}],
//          labels: [{at: [50, 55], text: '原点', anchor?, tone?, bold?}], height?, width?})
// A position is [x, y] or the id of a point. Layout places the ticks, labels and dimension lines; verify reports labels that
// overlap each other or leave the figure.
export function plane<const Id extends string = never>(opts: PlaneOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function plane(opts: PlaneOpts): PlaneBand {
  assertTextRole(opts?.labelRole, LABEL_ROLES, 'plane() labelRole');
  for (const k of ['x', 'y'] as const) {
    const a = opts?.[k];
    if (a && a.step !== undefined && !(a.step > 0 && Number.isFinite(a.step))) throw new Error(`plane(): axis ${k} step must be a number > 0 (got ${a.step})`);
    if (!a || typeof a.max !== 'number') throw new Error(`plane(): "${k}" needs an axis, e.g. {max: 100}`);
    if (a.max <= (a.min ?? 0)) throw new Error(`plane(): axis ${k} needs max > min`);
    if (a.categories !== undefined) {
      const c = a.categories;
      if (!Array.isArray(c) || !c.length || c.some(s => typeof s !== 'string' || !s)) throw new Error(`plane(): axis ${k} categories must be a non-empty list of names, e.g. ['営業', '開発']`);
      if (a.ticks !== undefined || a.step !== undefined) throw new Error(`plane(): axis ${k} takes categories or ticks / step, not both (the categories are its ticks)`);
      if ((a.min ?? 0) >= 1 || a.max < c.length) throw new Error(`plane(): axis ${k} puts its ${c.length} categories at 1..${c.length}, so it needs min < 1 and max >= ${c.length} (use max: ${c.length + 1})`);
    }
  }
  if (opts.stages !== undefined) {
    const st = opts.stages, name = (q: string | {name: string}) => typeof q === 'string' ? q : q?.name;
    if (!Array.isArray(st) || st.length < 2 || st.some(q => typeof name(q) !== 'string' || !name(q))) throw new Error("plane(): stages must be a list of at least 2 names (or {name, to?}), e.g. ['起源', 'カスタム', '製品', 'コモディティ']");
    if (opts.x.ticks !== undefined || opts.x.step !== undefined || opts.x.categories !== undefined) throw new Error('plane(): stages are the x axis ticks, so x takes no ticks / step / categories with them');
    const tos = st.map(q => typeof q === 'string' ? undefined : q.to);
    if (tos.some(t => t !== undefined)) {
      const min = opts.x.min ?? 0, inner = tos.slice(0, -1);
      if (tos[tos.length - 1] !== undefined) throw new Error("plane(): the last stage runs to the end of the x axis, so it takes no `to`");
      if (inner.some(t => typeof t !== 'number' || !Number.isFinite(t))) throw new Error('plane(): when a stage says where it ends (`to`), every stage but the last must');
      if (inner.some((t, i) => (t as number) <= (i ? inner[i - 1] as number : min) || (t as number) >= opts.x.max)) throw new Error('plane(): stage `to` values must increase and stay inside the x axis');
    }
  }
  for (const p of opts.points ?? []) if (p.evolves) {
    const to = p.evolves.to, min = opts.x.min ?? 0;
    if (typeof to !== 'number' || !(to > p.at[0]) || to > opts.x.max || to < min) throw new Error(`plane(): a point's evolves.to must be a number right of the point (x ${p.at[0]}) and inside the x axis (got ${to})`);
  }
  return withHandle({type: 'plane', ...opts, height: opts.height ?? 300}, opts.id);
}
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
