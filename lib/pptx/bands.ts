// Band -> slide XML. Every laid-out band type is declared here once: a function when it maps to native shapes, 'image' when it is
// drawn as a picture (SVG with a PNG fallback). Shape ids are handed out in the order shapes are written, which fixes the output's bytes.
import type {LaidOutOf, LaidOutType} from '../band-table.ts';
import type {LaidOutDiagram, LaidOutBand} from '../types/index.ts';
import {escapeXml} from '../emit-common.ts';
import {fitConnector, siteIndex} from './geom.ts';
import {type Rect, type Fonts} from './xml.ts';
import {boxXml, plainBox, groupFrameXml, groupXml, anchorXml, picXml, type TextBox} from './shapes.ts';
import {tableXml} from './table.ts';
import {rowArrowXml, type Glue} from './connectors.ts';
import {bandPicture, type Picture} from './image-band.ts';
import {imageRids} from './package.ts';

/** What the bands of one slide share: ids, the shapes connectors can glue to, and the pictures to rasterize. */
export interface Ctx {
  ld: LaidOutDiagram;
  fonts: Fonts;
  next(): number;
  glue: Map<string, {id: number; rect: Rect}>;
  pictures: Picture[];
}
/** The bands drawn as pictures: all have a height (`row` and `grid`, which do not, are native). */
type DrawnBand = Extract<LaidOutBand, {h: number}>;
type BandXml<B> = (band: B, ctx: Ctx, index: number) => string;
/** A box or banner, with the parts a box may carry beside its frame. */
type BoxLike = TextBox & Pick<LaidOutOf<'box'>, 'id' | 'tag' | 'tagBox' | 'stamp' | 'stampW' | 'step' | 'icon'>;

/** Remember a DSL id so connectors can glue to this shape. */
const register = (ctx: Ctx, dslId: string | undefined, id: number, rect: Rect): void => { if (dslId) ctx.glue.set(dslId, {id, rect}); };

/** Font size of the small badges (tag, stamp, step) a box carries beside its main shape. */
const badgeSize = (r: Rect): number => Math.min(12, Math.max(8, r.h * 0.48));

const boxBand = (b: BoxLike, ctx: Ctx): string => {
  const id = ctx.next();
  register(ctx, b.id, id, b);
  const main = boxXml(id, b.id ?? `box-${id}`, b, ctx.ld.day, ctx.fonts);
  if (!b.tag && !b.stamp && b.step === undefined && !b.icon) return main;
  const badge = (text: string, r: Rect, name: string): string =>
    boxXml(ctx.next(), name, plainBox(r, text, {size: badgeSize(r), weight: 700, tone: b.tone, frame: true, padX: 2, padY: 1}), ctx.ld.day, ctx.fonts);
  const extra: string[] = [];
  if (b.tag && b.tagBox) extra.push(badge(b.tag, b.tagBox, `tag-${id}`));
  if (b.stamp) extra.push(badge(b.stamp, {x: b.x + b.w - (b.stampW ?? 64) - 8, y: b.y + b.h - 22, w: b.stampW ?? 64, h: 18}, `stamp-${id}`));
  // the icon glyph is not drawn yet (ADR 0027 follow-up): an empty frame in its place would read as a real shape
  if (b.step !== undefined) extra.push(badge(String(b.step), {x: b.x + 8 + (b.icon ? 34 : 0), y: b.y + 8, w: 24, h: 24}, `step-${id}`));
  const minY = Math.min(b.y, b.tagBox?.y ?? b.y), maxY = Math.max(b.y + b.h, (b.tagBox?.y ?? b.y) + (b.tagBox?.h ?? 0));
  return groupXml(ctx.next(), `box-parts-${b.id ?? id}`, {x: b.x, y: minY, w: b.w, h: maxY - minY}, main + extra.join(''));
};

/** Text only: no frame, no padding (the svg writes it at band.x / band.y). Its `tone` colours the text, which the runs already carry, so it is not passed as the box's. */
const captionBand: BandXml<LaidOutOf<'caption'>> = (band, ctx) => {
  const id = ctx.next();
  const text: TextBox = {...band, tone: undefined, frame: false, padX: 0, padY: 0, align: band.align ?? 'center'};
  return boxXml(id, `caption-${id}`, text, ctx.ld.day, ctx.fonts);
};

const verticalExtent = (children: Rect[]): {y: number; h: number} => {
  const y = Math.min(...children.map(c => c.y));
  return {y, h: Math.max(...children.map(c => c.y + c.h)) - y};
};

const rowBand: BandXml<LaidOutOf<'row'>> = (band, ctx) => {
  const gid = ctx.next();
  const inner = band.children.map(c => boxBand(c, ctx)).join('');
  const group = groupXml(gid, `row${band.id ? '-' + band.id : ''}`, band, inner);
  const nearest = (x: number, y: number) => band.children.map(c => ({c, d: Math.min(Math.abs(x - c.x), Math.abs(x - c.x - c.w), Math.abs(y - c.y), Math.abs(y - c.y - c.h))})).sort((u, v) => u.d - v.d)[0];
  const rowGlue = (x: number, y: number): Glue | undefined => {
    const n = nearest(x, y), shape = n?.c.id ? ctx.glue.get(n.c.id) : undefined;
    return n && shape && n.d <= 2 ? {id: shape.id, idx: siteIndex(n.c, {x, y}, '')} : undefined;
  };
  const arrows = band.arrows.flatMap((a, i) => {
    const fit = fitConnector([{x: a.x1, y: a.y1}, {x: a.x2, y: a.y2}]);
    return fit.ok ? [rowArrowXml(ctx.next(), `row-arrow-${i}`, fit.x, rowGlue(a.x1, a.y1), rowGlue(a.x2, a.y2))] : [];
  });
  return group + arrows.join('');
};

const gridBand: BandXml<LaidOutOf<'grid'>> = (band, ctx) => {
  const gid = ctx.next();
  const inner = band.children.map(c => boxBand(c, ctx)).join('');
  return groupXml(gid, 'grid', {...verticalExtent(band.children), x: band.x, w: band.w}, inner);
};

const groupFrameBand: BandXml<LaidOutOf<'group'>> = (band, ctx) => {
  const id = ctx.next();
  register(ctx, band.id, id, band);
  return groupFrameXml(id, band.id ?? 'group-' + id, band, band.tone, band.dashed, ctx.ld.day);
};

const tableBand: BandXml<LaidOutOf<'table'>> = (band, ctx) => {
  const id = ctx.next();
  register(ctx, band.id, id, band);
  return tableXml(id, band, ctx.ld.day, ctx.fonts);
};

/** A band with no native mapping: drawn alone as SVG + PNG and placed as one picture; an invisible anchor keeps its DSL id glue-able. */
const imageBand: BandXml<DrawnBand> = (band, ctx, index) => {
  const {picture, rect} = bandPicture(ctx.ld, band, index);
  const rids = imageRids(ctx.pictures.length);
  ctx.pictures.push(picture);
  const pic = picXml(ctx.next(), `${band.type}-${index}`, rect, rids.png, rids.svg);
  if (!('id' in band && band.id)) return pic;
  const anchor = {x: band.x, y: band.y, w: band.w, h: band.h};
  const anchorId = ctx.next();
  register(ctx, band.id, anchorId, anchor);
  return pic + anchorXml(anchorId, `anchor-${band.id}`, anchor);
};

/** One disposition per laid-out band type; a missing band type fails compilation. */
export const BAND_HANDLERS = {
  caption: captionBand, box: boxBand, banner: boxBand, group: groupFrameBand, row: rowBand, grid: gridBand, table: tableBand,
  legend: 'image', swimlane: 'image', wireframe: 'image', screens: 'image', sequence: 'image', raw: 'image', pyramid: 'image',
  curve: 'image', plane: 'image', quadrant: 'image', wordart: 'image', chevron: 'image', funnel: 'image', cycle: 'image',
  venn: 'image', concentric: 'image', bars: 'image', chart: 'image', image: 'image', people: 'image', dots: 'image', math: 'image',
  timeline: 'image', tree: 'image', states: 'image', cause: 'image', cloud: 'image', gantt: 'image', classes: 'image', bpmn: 'image',
  fta: 'image', bowtie: 'image', status: 'image',
} satisfies {[T in LaidOutType]: BandXml<LaidOutOf<T>> | 'image'};

export function bandXml(band: LaidOutBand, ctx: Ctx, index: number): string {
  // the one place the band type and its handler are correlated by hand (lib/emit.ts's EMIT_HANDLERS does the same)
  const handler = BAND_HANDLERS[band.type] as BandXml<LaidOutBand> | 'image';
  return handler === 'image' ? imageBand(band as DrawnBand, ctx, index) : handler(band, ctx, index);
}
