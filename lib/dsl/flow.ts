import {chevronBand, concentricBand, cycleBand, emblemBand, funnelBand, valueChainBand, vennBand} from '../flow-shapes.ts';
import type {ChevronBand, ChevronOpts, ConcentricBand, ConcentricMark, ConcentricOpts, ConcentricRing, ConcentricSector, CycleBand, CycleOpts, EmblemBand, EmblemItem, EmblemOpts, FlowStep, FunnelBand, FunnelOpts, FunnelStage, ValueChainBand, ValueChainOpts, VennBand, VennOpts, VennSet} from '../flow-shapes.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {withHandle} from './shared.ts';

type ItemIds<I extends readonly {id?: string}[]> = I[number] extends infer E ? E extends {readonly id: infer X extends string} ? X : never : never;
type ShapeExtra<B, Id extends string, I extends readonly {id?: string}[]> = B & Declares<Id | ItemIds<I>> & HandleOf<Id>;
/** A row or column of arrow-shaped process steps. Step ids are anchors for connect() and spotlight. */
export function chevron<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: ChevronOpts & {id?: Id}): ShapeExtra<ChevronBand, Id, I> { return withHandle(chevronBand(steps, opts), opts?.id) as ShapeExtra<ChevronBand, Id, I>; }
/** A narrowing stack of funnel stages. `scale: 'value'` uses each stage value; `showRate` prints conversion from the preceding stage. */
export function funnel<const Id extends string = never, const I extends readonly FunnelStage[] = readonly FunnelStage[]>(stages: I, opts?: FunnelOpts & {id?: Id}): ShapeExtra<FunnelBand, Id, I> { return withHandle(funnelBand(stages, opts), opts?.id) as ShapeExtra<FunnelBand, Id, I>; }
/**
 * Three to eight nodes joined as a closed circular process. Node ids are anchors for connect() and spotlight.
 * With `links` (ADR 0065) the nodes sit on a regular polygon (four on a square) joined pair by pair instead — 'all' (every pair, two-way) or
 * [{from, to, label, direction: 'forward'}] — and `frame` puts a named frame round it: the CBT five-part model.
 *   cycle([{label: '思考'}, {label: '感情'}, {label: '行動'}, {label: '身体'}], {links: 'all', frame: '状況・環境'})
 */
export function cycle<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: CycleOpts & {id?: Id}): ShapeExtra<CycleBand, Id, I> { return withHandle(cycleBand(steps, opts), opts?.id) as ShapeExtra<CycleBand, Id, I>; }
/**
 * Porter's value chain (価値連鎖 / バリューチェーン): support activities (支援活動) as bars over the primary activities (主活動) as chevrons, with the
 * margin (マージン) as an arrow at the right end. Items are labels or `{label, sub, id, tone}`; ids are anchors for connect() and spotlight.
 *   valueChain({support: ['全般管理', '人事・労務管理', '技術開発', '調達活動'], primary: ['購買物流', '製造', '出荷物流', '販売・マーケティング', 'サービス']})
 * `margin: false` leaves the arrow out (a chain of activities only); `titles: false` leaves out the two captions.
 */
export function valueChain<const Id extends string = never, const S extends readonly (string | FlowStep)[] = readonly (string | FlowStep)[], const P extends readonly (string | FlowStep)[] = readonly (string | FlowStep)[]>(parts: {support?: S; primary: P}, opts?: ValueChainOpts & {id?: Id}): ValueChainBand & Declares<Id | ItemIds<Extract<S[number] | P[number], {id?: string}>[]>> & HandleOf<Id> { return withHandle(valueChainBand(parts, opts), opts?.id) as never; }
/** A two- or three-set Venn diagram. Dashed outlines supplement translucent colours, so sets are not distinguished by colour alone. */
export function venn<const Id extends string = never, const I extends readonly VennSet[] = readonly VennSet[]>(sets: I, opts?: VennOpts & {id?: Id}): ShapeExtra<VennBand, Id, I> { return withHandle(vennBand(sets, opts), opts?.id) as ShapeExtra<VennBand, Id, I>; }
/**
 * Nested rings, ordered from the outside or inside, with labels in the rings or in a side key.
 * With `sectors` (ADR 0065) the rings are cut into sectors from 12 o'clock clockwise and carry `marks` — the ACT Values Bullseye, a technology
 * radar. A mark sits in its sector at a ring (number as `rings` is written, or name) or at r (0 = centre, 1 = edge); `from` draws its move.
 *   concentric(4, {sectors: [{label: '仕事'}, {label: '家族'}], centre: '価値に沿った生き方', marks: [{label: '週1で運動', sector: 1, r: .3, from: {r: .7}}]})
 *   concentric([{label: 'Adopt'}, {label: 'Trial'}, {label: 'Assess'}, {label: 'Hold'}], {order: 'inner-first', sectors: [...], marks: [{label: 'Biome', sector: 2, ring: 'Adopt'}]})
 * `layout: 'stack'` draws the same data as a column of boxes per sector, a row per ring (the innermost at the top, the centre word over the columns).
 * `rings` may be a count of plain rings when there are sectors. Ring, sector and mark ids are anchors for connect() and spotlight.
 */
export function concentric<const Id extends string = never, const S extends readonly ConcentricSector[] = readonly ConcentricSector[], const M extends readonly ConcentricMark[] = readonly ConcentricMark[]>(rings: number, opts: ConcentricOpts & {id?: Id; sectors: S; marks?: M}): ShapeExtra<ConcentricBand, Id, [...S, ...M]>;
export function concentric<const Id extends string = never, const I extends readonly ConcentricRing[] = readonly ConcentricRing[], const S extends readonly ConcentricSector[] = readonly ConcentricSector[], const M extends readonly ConcentricMark[] = readonly ConcentricMark[]>(rings: I, opts?: ConcentricOpts & {id?: Id; sectors?: S; marks?: M}): ShapeExtra<ConcentricBand, Id, [...I, ...S, ...M]>;
export function concentric(rings: readonly ConcentricRing[] | number, opts?: ConcentricOpts): ConcentricBand { return withHandle(concentricBand(rings, opts), opts?.id); }
/**
 * A word or two inside a circle, square, triangle, diamond or hexagon (図形に文字を入れたもの). The shape grows to hold its text, and all the
 * shapes of one band share a size; they wrap to the next row when the width runs out. `sub` is a smaller line under the label.
 *   emblem('重要', {shape: 'triangle', tone: 'danger', id: 'warn'})                      // one shape; `id` is its anchor
 *   emblem([{label: '課題', shape: 'hexagon'}, {label: '原因', sub: '3 件'}], {shape: 'circle'})   // several; `shape` is the default
 * Other tools call this a "shape" (PowerPoint, Visio) or a "node" (Graphviz, Mermaid). Item ids are anchors for connect() and spotlight.
 */
export function emblem<const Id extends string = never>(label: string, opts?: Omit<EmblemItem, 'label'> & Omit<EmblemOpts, 'shape' | 'id' | 'gap'> & {id?: Id}): EmblemBand & Declares<Id> & HandleOf<Id>;
export function emblem<const Id extends string = never, const I extends readonly EmblemItem[] = readonly EmblemItem[]>(items: I, opts?: EmblemOpts & {id?: Id}): ShapeExtra<EmblemBand, Id, I>;
export function emblem(first: string | readonly EmblemItem[], opts: (Omit<EmblemItem, 'label'> & EmblemOpts) | undefined = undefined): EmblemBand {
  if (typeof first !== 'string') return withHandle(emblemBand(first, opts), opts?.id);
  const {sub, shape, tone, id, ...band} = opts ?? {};
  const built = emblemBand([{label: first, ...(sub !== undefined ? {sub} : {}), ...(shape ? {shape} : {}), ...(tone ? {tone} : {}), ...(id ? {id} : {})}], band);
  return withHandle(built, id && built.scope ? `${built.scope}.${id}` : id); // a scoped item is registered as <scope>.<id> (ADR 0012)
}
