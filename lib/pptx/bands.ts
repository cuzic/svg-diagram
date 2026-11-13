// Band -> slide XML. Every laid-out band type is declared here once: a function when it maps to native shapes, 'image' when it is
// drawn as a picture (SVG with a PNG fallback). Shape ids are handed out in the order shapes are written, which fixes the output's bytes.
import type {LaidOutOf, LaidOutType} from '../band-table.ts';
import type {LaidOutDiagram, LaidOutBand} from '../types/index.ts';
import {fitConnector, siteIndex} from './geom.ts';
import type {Rect, Fonts} from './xml.ts';
import {PALETTE, recolor, type ToneEnv} from '../tokens.ts';
import {boxTextXml, geomShapeXml, lineXml, presetXml, roundGeomXml} from './prims.ts';
import {ringed, stepBadgeAt} from '../emit-boxes.ts';
import {badgeTextKey} from '../badge.ts';
import {boxXml, plainBox, groupFrameXml, groupXml, anchorXml, picXml, type TextBox} from './shapes.ts';
import {tableXml} from './table.ts';
import {freeformPathXml, rowArrowXml, type Glue} from './connectors.ts';
import {bandPicture, type Picture} from './image-band.ts';
import {imageRids} from './package.ts';
import {treeXml} from './tree.ts';
import {quadrantXml} from './quadrant.ts';
import {statesXml} from './states.ts';
import {causeXml} from './cause.ts';
import {legendNative, legendXml} from './legend.ts';
import {flowShapeXml, pyramidXml, timelineXml} from './flow.ts';
import {svgShapesXml} from './svg-shapes.ts';
import type {LaidOutFlowShape} from '../flow-shapes.ts';

/** What the bands of one slide share: ids, the shapes connectors can glue to, and the pictures to rasterize. */
export interface Ctx {
  ld: LaidOutDiagram;
  /** The diagram's tone overrides (planSlide resolves them once from ld.tones). */
  tones: ToneEnv;
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
  const main = boxXml(id, b.id ?? `box-${id}`, b, ctx.ld.day, ctx.tones, ctx.fonts);
  if (!b.tag && !b.stamp && b.step === undefined && !b.icon) return main;
  const badge = (text: string, r: Rect, name: string): string =>
    boxXml(ctx.next(), name, plainBox(r, text, {size: badgeSize(r), weight: 700, tone: b.tone, frame: true, padX: 2, padY: 1}), ctx.ld.day, ctx.tones, ctx.fonts);
  const extra: string[] = [];
  if (b.tag && b.tagBox) extra.push(badge(b.tag, b.tagBox, `tag-${id}`));
  if (b.stamp) extra.push(badge(b.stamp, {x: b.x + b.w - (b.stampW ?? 64) - 8, y: b.y + b.h - 22, w: b.stampW ?? 64, h: 18}, `stamp-${id}`));
  // the icon glyph is not drawn yet (ADR 0027 follow-up): an empty frame in its place would read as a real shape
  if (b.step !== undefined && 'wrappedRuns' in b) {
    // as the svg draws it (emit-boxes.ts stepBadgeAt): a circle in the accent with the number in white on the title's baseline
    const g = stepBadgeAt(b, ctx.ld.roles), r = {x: g.cx - g.r, y: g.cy - g.r, w: 2 * g.r, h: 2 * g.r}, fill = PALETTE[ctx.ld.day].accent;
    const line = {text: String(b.step), x: g.cx, y: g.baseline, anchor: 'middle' as const, size: g.size, bold: true, color: PALETTE[badgeTextKey(fill)]};
    extra.push(geomShapeXml(ctx.next(), `step-${id}`, r, roundGeomXml('ellipse', r.w, r.h), {fill, ...(ringed(b) ? {stroke: PALETTE.bg, widthPx: 2} : {})}, boxTextXml(r, [line], ctx.fonts)));
  } else if (b.step !== undefined) extra.push(badge(String(b.step), {x: b.x + 8 + (b.icon ? 34 : 0), y: b.y + 8, w: 24, h: 24}, `step-${id}`));
  const minY = Math.min(b.y, b.tagBox?.y ?? b.y), maxY = Math.max(b.y + b.h, (b.tagBox?.y ?? b.y) + (b.tagBox?.h ?? 0));
  return groupXml(ctx.next(), `box-parts-${b.id ?? id}`, {x: b.x, y: minY, w: b.w, h: maxY - minY}, main + extra.join(''));
};

/** Text only: no frame, no padding (the svg writes it at band.x / band.y). Its `tone` colours the text, which the runs already carry, so it is not passed as the box's. */
const captionBand: BandXml<LaidOutOf<'caption'>> = (band, ctx) => {
  const id = ctx.next();
  const text: TextBox = {...band, tone: undefined, frame: false, padX: 0, padY: 0, align: band.align ?? 'center'};
  return boxXml(id, `caption-${id}`, text, ctx.ld.day, ctx.tones, ctx.fonts);
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
  return groupFrameXml(id, band.id ?? 'group-' + id, band, band.tone, band.dashed, ctx.ld.day, ctx.tones);
};

const tableBand: BandXml<LaidOutOf<'table'>> = (band, ctx) => {
  const id = ctx.next();
  register(ctx, band.id, id, band);
  return tableXml(id, band, ctx.ld, ctx.tones, ctx.fonts) + rowCurveXml(band, ctx);
};

/** A journey map's emotion curve over its table, as the svg draws it: the neutral line dashed, the curve, a hollow dot at each point. */
function rowCurveXml(band: LaidOutOf<'table'>, ctx: Ctx): string {
  const c = band.rowCurve;
  if (!c?.points.length) return '';
  const accent = PALETTE[ctx.ld.day].accent, out: string[] = [];
  out.push(lineXml(ctx.next(), 'emotion-neutral', {x: (band.colX[1] ?? band.x) + 8, y: c.midY}, {x: band.x + band.w - 8, y: c.midY}, PALETTE.muted, 1.5, {dashed: true}));
  if (c.points.length > 1) { const id = ctx.next(); out.push(freeformPathXml(id, 'emotion-curve', c.points.map((p, i) => ({op: i ? 'L' as const : 'M' as const, pts: [p]})), accent, 2.5)); }
  for (const p of c.points) out.push(presetXml(ctx.next(), 'emotion', 'ellipse', {x: p.x - 4, y: p.y - 4, w: 8, h: 8}, {fill: PALETTE.bg, stroke: accent, widthPx: 2.5}));
  return groupXml(ctx.next(), 'emotion-curve', {x: band.x, y: c.top, w: band.w, h: c.bottom - c.top}, out.join(''));
}

/** A tree as shapes (./tree.ts); a dimmed one stays a picture, as the muted look is not mapped yet. */
const treeBand: BandXml<LaidOutOf<'tree'>> = (band, ctx, index) => {
  if (band.dim) return imageBand(band, ctx, index);
  const {xml, glue} = treeXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
  for (const g of glue) register(ctx, g.dslId, g.id, g.rect);
  return xml;
};

/** A quadrant as shapes (./quadrant.ts); a dimmed one stays a picture. */
const quadrantBand: BandXml<LaidOutOf<'quadrant'>> = (band, ctx, index) => {
  if (band.dim) return imageBand(band, ctx, index);
  const {xml, glue} = quadrantXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
  for (const g of glue) register(ctx, g.dslId, g.id, g.rect);
  return xml;
};

/** A state diagram or flowchart as shapes (./states.ts); a dimmed one, or one with icons, stays a picture. */
const statesBand: BandXml<LaidOutOf<'states'>> = (band, ctx, index) => {
  if (band.dim || band.icons.length) return imageBand(band, ctx, index);
  const {xml, glue} = statesXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
  for (const g of glue) register(ctx, g.dslId, g.id, g.rect);
  return xml;
};

/** A cause-and-effect band as shapes (./cause.ts); a dimmed one stays a picture. */
const causeBand: BandXml<LaidOutOf<'cause'>> = (band, ctx, index) => {
  if (band.dim) return imageBand(band, ctx, index);
  const {xml, glue} = causeXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
  for (const g of glue) register(ctx, g.dslId, g.id, g.rect);
  return xml;
};

/** A legend as shapes (./legend.ts), unless it has a sample not drawn as shapes yet. */
const legendBand: BandXml<LaidOutOf<'legend'>> = (band, ctx, index) => legendNative(band) ? legendXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next) : imageBand(band, ctx, index);

/** A flow shape (chevron, funnel, cycle, Venn, concentric, emblem, value chain) as shapes (./flow.ts); a dimmed one stays a picture. */
const flowBand: BandXml<LaidOutFlowShape> = (band, ctx, index) => {
  if (band.dim) return imageBand(band, ctx, index);
  const {xml, glue} = flowShapeXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
  for (const g of glue) register(ctx, g.dslId, g.id, g.rect);
  return xml;
};
const pyramidBand: BandXml<LaidOutOf<'pyramid'>> = (band, ctx) => pyramidXml(band, ctx.ld, ctx.fonts, ctx.next);
const timelineBand: BandXml<LaidOutOf<'timeline'>> = (band, ctx, index) => band.dim ? imageBand(band, ctx, index) : timelineXml(band, ctx.ld, ctx.fonts, ctx.next);

/**
 * A band with no mapping of its own: drawn as shapes from its own SVG (./svg-shapes.ts) when that SVG uses only what the converter reads,
 * else as one picture (SVG + PNG). Either way an invisible anchor keeps its DSL id glue-able.
 */
const imageBand: BandXml<DrawnBand> = (band, ctx, index) => {
  const {picture, rect} = bandPicture(ctx.ld, band, index);
  const shapes = svgShapesXml(picture.svg, ctx.fonts, ctx.next);
  let drawn: string;
  if (shapes !== null) drawn = groupXml(ctx.next(), `${band.type}-${index}`, rect, shapes);
  else {
    const rids = imageRids(ctx.pictures.length);
    ctx.pictures.push({svg: recolor(ctx.tones, picture.svg, ctx.ld.appearance), pngSvg: recolor(ctx.tones, picture.pngSvg, ctx.ld.appearance)});
    drawn = picXml(ctx.next(), `${band.type}-${index}`, rect, rids.png, rids.svg);
  }
  if (!('id' in band && band.id)) return drawn;
  const anchor = {x: band.x, y: band.y, w: band.w, h: band.h};
  const anchorId = ctx.next();
  register(ctx, band.id, anchorId, anchor);
  return drawn + anchorXml(anchorId, `anchor-${band.id}`, anchor);
};

/** One disposition per laid-out band type; a missing band type fails compilation. */
export const BAND_HANDLERS = {
  caption: captionBand, box: boxBand, banner: boxBand, group: groupFrameBand, row: rowBand, grid: gridBand, table: tableBand,
  legend: legendBand, swimlane: 'image', wireframe: 'image', screens: 'image', sequence: 'image', raw: 'image', pyramid: pyramidBand,
  curve: 'image', plane: 'image', quadrant: quadrantBand, wordart: 'image', chevron: flowBand, funnel: flowBand, cycle: flowBand,
  venn: flowBand, concentric: flowBand, emblem: flowBand, valueChain: flowBand, bars: 'image', chart: 'image', image: 'image', people: 'image', dots: 'image', math: 'image',
  timeline: timelineBand, tree: treeBand, states: statesBand, cause: causeBand, cloud: 'image', gantt: 'image', classes: 'image', bpmn: 'image',
  fta: 'image', status: 'image', bowtie: 'image',
} satisfies {[T in LaidOutType]: BandXml<LaidOutOf<T>> | 'image'};

export function bandXml(band: LaidOutBand, ctx: Ctx, index: number): string {
  // the one place the band type and its handler are correlated by hand (lib/emit.ts's EMIT_HANDLERS does the same)
  const handler = BAND_HANDLERS[band.type] as BandXml<LaidOutBand> | 'image';
  return handler === 'image' ? imageBand(band as DrawnBand, ctx, index) : handler(band, ctx, index);
}
