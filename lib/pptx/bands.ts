// Band -> slide XML. Every laid-out band type is declared here once: a function when it maps to native shapes, 'image' when it is
// drawn as a picture (SVG with a PNG fallback). Shape ids are handed out in the order shapes are written, which fixes the output's bytes.
import type {LaidOutOf, LaidOutType} from '../band-table.ts';
import type {LaidOutBand} from '../types/index.ts';
import {recolor} from '../tokens.ts';
import {namedAs} from './prims.ts';
import {groupXml, anchorXml, picXml} from './shapes.ts';
import {bandPicture} from './image-band.ts';
import {imageRids} from './package.ts';
import {svgShapesXml} from './svg-shapes.ts';

import {register} from './adapter.ts';
import type {BandXml, Ctx, PptxAdapter} from './adapter.ts';
import {bannerPptx, boxPptx, captionPptx, gridPptx, groupPptx, rowPptx} from './box-bands.ts';

import {tablePptx} from './table-band.ts';
import {treePptx} from './tree-band.ts';
import {quadrantPptx} from './quadrant-band.ts';
import {statesPptx} from './states-band.ts';
import {causePptx} from './cause-band.ts';
import {legendPptx} from './legend-band.ts';
import {flowPptx} from './flow-band.ts';
import {pyramidPptx} from './pyramid-band.ts';
import {timelinePptx} from './timeline-band.ts';

type DrawnBand = Extract<LaidOutBand, {h: number}>;

/** A band's group: its type, numbered from the second of that type on the slide (`chart`, `chart 2`), and its DSL id (ADR 0054 D7). */
function bandName(ctx: Ctx, type: string, dslId?: string): string {
  const n = (ctx.count.get(type) ?? 0) + 1;
  ctx.count.set(type, n);
  return namedAs(n > 1 ? `${type} ${n}` : type, '', dslId);
}

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
  caption: captionPptx, box: boxPptx, banner: bannerPptx, group: groupPptx, row: rowPptx, grid: gridPptx, table: tablePptx,
  legend: legendPptx, swimlane: 'image', wireframe: 'image', screens: 'image', sequence: 'image', raw: 'image', pyramid: pyramidPptx,
  curve: 'image', plane: 'image', quadrant: quadrantPptx, wordart: 'image', chevron: flowPptx, funnel: flowPptx, cycle: flowPptx,
  venn: flowPptx, concentric: flowPptx, emblem: flowPptx, valueChain: flowPptx, bars: 'image', chart: 'image', image: 'image', people: 'image', dots: 'image', math: 'image',
  timeline: timelinePptx, tree: treePptx, states: statesPptx, cause: causePptx, cloud: 'image', gantt: 'image', classes: 'image', bpmn: 'image',
  fta: 'image', status: 'image', bowtie: 'image', comic: 'image',
} satisfies {[T in LaidOutType]: PptxAdapter<LaidOutOf<T>> | 'image'};

export function bandXml(band: LaidOutBand, ctx: Ctx, index: number): string {
  // the one place the band type and its handler are correlated by hand (lib/emit.ts's EMIT_HANDLERS does the same)
  const handler = BAND_HANDLERS[band.type] as PptxAdapter<LaidOutBand> | 'image';
  return (handler === 'image' ? undefined : handler(band, ctx, index)) ?? imageBand(band as DrawnBand, ctx, index);
}
