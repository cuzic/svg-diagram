// Band -> slide XML. Every laid-out band type is declared here once: a function when it maps to native shapes, 'image' when it is
// drawn as a picture (SVG with a PNG fallback). Shape ids are handed out in the order shapes are written, which fixes the output's bytes.
import type {LaidOutOf, LaidOutType} from '../band-table.ts';
import type {LaidOutBand} from '../types/index.ts';
import {PALETTE, recolor} from '../tokens.ts';
import {lineXml, namedAs, presetXml} from './prims.ts';
import {groupXml, anchorXml, picXml} from './shapes.ts';
import {tableXml} from './table.ts';
import {freeformPathXml} from './connectors.ts';
import {bandPicture} from './image-band.ts';
import {imageRids} from './package.ts';
import {treeXml} from './tree.ts';
import {quadrantXml} from './quadrant.ts';
import {statesXml} from './states.ts';
import {causeXml} from './cause.ts';
import {legendNative, legendXml} from './legend.ts';
import {flowShapeXml, pyramidXml, timelineXml} from './flow.ts';
import {svgShapesXml} from './svg-shapes.ts';
import type {LaidOutFlowShape} from '../flow-shapes.ts';

import {register} from './adapter.ts';
import type {BandXml, Ctx} from './adapter.ts';
import {bannerPptx, boxPptx, captionPptx, gridPptx, groupPptx, rowPptx} from './box-bands.ts';

type DrawnBand = Extract<LaidOutBand, {h: number}>;

/** A band's group: its type, numbered from the second of that type on the slide (`chart`, `chart 2`), and its DSL id (ADR 0054 D7). */
function bandName(ctx: Ctx, type: string, dslId?: string): string {
  const n = (ctx.count.get(type) ?? 0) + 1;
  ctx.count.set(type, n);
  return namedAs(n > 1 ? `${type} ${n}` : type, '', dslId);
}

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
  if (shapes !== null) drawn = groupXml(ctx.next(), bandName(ctx, band.type, 'id' in band ? band.id : undefined), rect, shapes);
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
  caption: captionPptx, box: boxPptx, banner: bannerPptx, group: groupPptx, row: rowPptx, grid: gridPptx, table: tableBand,
  legend: legendBand, swimlane: 'image', wireframe: 'image', screens: 'image', sequence: 'image', raw: 'image', pyramid: pyramidBand,
  curve: 'image', plane: 'image', quadrant: quadrantBand, wordart: 'image', chevron: flowBand, funnel: flowBand, cycle: flowBand,
  venn: flowBand, concentric: flowBand, emblem: flowBand, valueChain: flowBand, bars: 'image', chart: 'image', image: 'image', people: 'image', dots: 'image', math: 'image',
  timeline: timelineBand, tree: treeBand, states: statesBand, cause: causeBand, cloud: 'image', gantt: 'image', classes: 'image', bpmn: 'image',
  fta: 'image', status: 'image', bowtie: 'image', comic: 'image',
} satisfies {[T in LaidOutType]: BandXml<LaidOutOf<T>> | 'image'};

export function bandXml(band: LaidOutBand, ctx: Ctx, index: number): string {
  // the one place the band type and its handler are correlated by hand (lib/emit.ts's EMIT_HANDLERS does the same)
  const handler = BAND_HANDLERS[band.type] as BandXml<LaidOutBand> | 'image';
  return handler === 'image' ? imageBand(band as DrawnBand, ctx, index) : handler(band, ctx, index);
}
