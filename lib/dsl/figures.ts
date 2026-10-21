import {quadrantBand} from '../quadrant.ts';
import type {QuadrantBand, QuadrantItem, QuadrantOpts, QuadrantPreset} from '../quadrant.ts';
import {chevronBand, concentricBand, cycleBand, emblemBand, funnelBand, vennBand} from '../flow-shapes.ts';
import type {ChevronBand, ChevronOpts, ConcentricBand, ConcentricOpts, ConcentricRing, CycleBand, CycleOpts, EmblemBand, EmblemItem, EmblemOpts, FlowStep, FunnelBand, FunnelOpts, FunnelStage, VennBand, VennOpts, VennSet} from '../flow-shapes.ts';
import {wordartBand} from '../wordart.ts';
import type {WordArtBand, WordArtOpts} from '../wordart.ts';
import {LABEL_ROLES} from '../tokens.ts';
import type {PlaneBand, PlaneOpts, CurveBand, CurveOpts, PyramidBand, PyramidLayer, PyramidOpts} from '../types/figures.ts';
import type {CurvePoints, Declares, HandleOf, PyramidLayers} from '../strict.ts';
import {assertNoReveal, assertTextRole, withHandle} from './shared.ts';

// Stacked trapezoid layers, bottom (widest) to top (narrowest) — a test
// pyramid, a maturity model, anything shaped like "few at the top, many at
// the bottom". `layers`: strings or {text}, bottom-to-top. Opacity and each
// layer's text color are derived (see tokens.ts's SHADES/bestTextColor),
// not chosen per diagram, so contrast is provably fine for any 2-6 layers.
// Types: a tuple of at least 2 layers.
export function pyramid(layers: PyramidLayers, opts?: PyramidOpts): PyramidBand;
export function pyramid(layers: (string | PyramidLayer)[], opts: PyramidOpts = {}): PyramidBand {
  assertNoReveal(opts, 'pyramid()');
  if (!Array.isArray(layers) || layers.length < 2) throw new Error('pyramid(layers) needs at least 2 layers, bottom to top');
  return {
    type: 'pyramid',
    layers: layers.map(l => typeof l === 'string' ? {text: l} : l),
    width: opts.width,
    layerHeight: opts.layerHeight ?? 76,
    apexRatio: opts.apexRatio ?? 0.3,
  };
}
// An axis + a connected-dot trend line — a decay/growth curve, a shift-left
// curve, anything shaped like "value over an ordered sequence". `points`:
// {y: 0..1 (0 = axis bottom, 1 = axis top), emphasis?: 'accent'|'danger'|
// 'muted', dropLine?: true} evenly spaced left-to-right along the x-axis.
// Bespoke callouts (leader lines to side notes, etc.) are raw()'s job —
// curve() only draws the reusable skeleton.
// Types: a tuple of at least 2 points, each with a numeric y.
export function curve(points: CurvePoints, opts?: CurveOpts): CurveBand;
export function curve(points: CurveBand['points'], opts: CurveOpts = {}): CurveBand {
  assertNoReveal(opts, 'curve()');
  if (!Array.isArray(points) || points.length < 2) throw new Error('curve(points) needs at least 2 points');
  for (const p of points) {
    if (typeof p.y !== 'number') throw new Error('curve(): every point needs a numeric y (0 = axis bottom, 1 = axis top)');
  }
  return {
    type: 'curve', points,
    height: opts.height ?? 220,
    width: opts.width,
    yTopLabel: opts.yTopLabel, yBottomLabel: opts.yBottomLabel, xLabel: opts.xLabel,
  };
}
// A coordinate plane: axes with ticks, points, guide lines, dimension lines and labels, all in the plane's own units.
//   plane({x: {label: 'x', max: 100, step: 20}, y: {label: 'y', max: 60}, yDown?: true (image coordinates), grid?: true,
//          points: [{id: 'a', at: [20, 10], label: 'A', labelAt?, tone?, shape?: 'dot' | 'ring' | 'cross'}],
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
type ItemIds<I extends readonly {id?: string}[]> = I[number] extends infer E ? E extends {readonly id: infer X extends string} ? X : never : never;
type ShapeExtra<B, Id extends string, I extends readonly {id?: string}[]> = B & Declares<Id | ItemIds<I>> & HandleOf<Id>;
/** A row or column of arrow-shaped process steps. Step ids are anchors for connect() and spotlight. */
export function chevron<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: ChevronOpts & {id?: Id}): ShapeExtra<ChevronBand, Id, I> { return withHandle(chevronBand(steps, opts), opts?.id) as ShapeExtra<ChevronBand, Id, I>; }
/** A narrowing stack of funnel stages. `scale: 'value'` uses each stage value; `showRate` prints conversion from the preceding stage. */
export function funnel<const Id extends string = never, const I extends readonly FunnelStage[] = readonly FunnelStage[]>(stages: I, opts?: FunnelOpts & {id?: Id}): ShapeExtra<FunnelBand, Id, I> { return withHandle(funnelBand(stages, opts), opts?.id) as ShapeExtra<FunnelBand, Id, I>; }
/** Three to eight nodes joined as a closed circular process. Node ids are anchors for connect() and spotlight. */
export function cycle<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: CycleOpts & {id?: Id}): ShapeExtra<CycleBand, Id, I> { return withHandle(cycleBand(steps, opts), opts?.id) as ShapeExtra<CycleBand, Id, I>; }
/** A two- or three-set Venn diagram. Dashed outlines supplement translucent colours, so sets are not distinguished by colour alone. */
export function venn<const Id extends string = never, const I extends readonly VennSet[] = readonly VennSet[]>(sets: I, opts?: VennOpts & {id?: Id}): ShapeExtra<VennBand, Id, I> { return withHandle(vennBand(sets, opts), opts?.id) as ShapeExtra<VennBand, Id, I>; }
/** Nested rings, ordered from the outside or inside, with labels in the rings or in a side key. */
export function concentric<const Id extends string = never, const I extends readonly ConcentricRing[] = readonly ConcentricRing[]>(rings: I, opts?: ConcentricOpts & {id?: Id}): ShapeExtra<ConcentricBand, Id, I> { return withHandle(concentricBand(rings, opts), opts?.id) as ShapeExtra<ConcentricBand, Id, I>; }
/**
 * A word or two inside a circle, square, triangle, diamond or hexagon (図形に文字を入れたもの). The shape grows to hold its text, and all the
 * shapes of one band share a size; they wrap to the next row when the width runs out. `sub` is a smaller line under the label.
 *   emblem('重要', {kind: 'triangle', tone: 'danger', id: 'warn'})                      // one shape; `id` is its anchor
 *   emblem([{label: '課題', kind: 'hexagon'}, {label: '原因', sub: '3 件'}], {kind: 'circle'})   // several; `kind` is the default
 * Other tools call this a "shape" (PowerPoint, Visio) or a "node" (Graphviz, Mermaid). Item ids are anchors for connect() and spotlight.
 */
export function emblem<const Id extends string = never>(label: string, opts?: Omit<EmblemItem, 'label'> & Omit<EmblemOpts, 'kind' | 'id'> & {id?: Id}): EmblemBand & Declares<Id> & HandleOf<Id>;
export function emblem<const Id extends string = never, const I extends readonly EmblemItem[] = readonly EmblemItem[]>(items: I, opts?: EmblemOpts & {id?: Id}): ShapeExtra<EmblemBand, Id, I>;
export function emblem(first: string | readonly EmblemItem[], opts: (Omit<EmblemItem, 'label'> & EmblemOpts) | undefined = undefined): EmblemBand {
  if (typeof first !== 'string') return withHandle(emblemBand(first, opts), opts?.id);
  const {sub, kind, tone, id, ...band} = opts ?? {};
  return withHandle(emblemBand([{label: first, ...(sub !== undefined ? {sub} : {}), ...(kind ? {kind} : {}), ...(tone ? {tone} : {}), ...(id ? {id} : {})}], band), id);
}
/**
 * Decorated headline text (ワードアート): bold, outlined (縁取り), shadowed, glowing, bent, turned ..., set horizontally or vertically
 * (縦書き), as one band.
 *   wordart('新製品発表', {style: 'sticker', writing: 'vertical', size: 'display'})
 *   wordart('SALE', {style: 'outline', size: 72})
 * `style` picks a look ('plain' | 'bold' | 'outline' | 'shadow' | 'sticker' | 'glow' | 'emboss' | '3d' | 'gradient' | 'reflect'); `tone`,
 * `gradient`, `outline`, `shadow`, `glow`, `bevel`, `extrude`, `reflection`, `arc`, `rotate`, `flip`, `font`, `plate` adjust it.
 * Colours are tone keys. verifyDiagram() rejects letters that would not read (a white letter with no dark outline on a white page).
 */
export function wordart<const Id extends string = never>(text: string, opts?: WordArtOpts & {id?: Id}): WordArtBand & Declares<Id> & HandleOf<Id> { return withHandle(wordartBand(text, opts), opts?.id) as WordArtBand & Declares<Id> & HandleOf<Id>; }
