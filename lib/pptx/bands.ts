// Band -> slide XML. Every laid-out band type is declared here once: a function when it maps to native shapes, 'image' when it is
// drawn as a picture (SVG with a PNG fallback). Shape ids are handed out in the order shapes are written, which fixes the output's bytes.
import type {LaidOutOf, LaidOutType} from '../band-table.ts';
import type {LaidOutBand} from '../types/index.ts';
import {drawBandFallback} from './band-fallback.ts';
import {bandPicture} from './image-band.ts';
import {svgShapesXml} from './svg-shapes.ts';

import type {Ctx, PptxAdapter} from './adapter.ts';
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

/** One disposition per laid-out band type; a missing band type fails compilation. */
export const BAND_HANDLERS = {
  caption: captionPptx, box: boxPptx, banner: bannerPptx, group: groupPptx, row: rowPptx, grid: gridPptx, table: tablePptx,
  legend: legendPptx, swimlane: 'image', wireframe: 'image', screens: 'image', sequence: 'image', raw: 'image', pyramid: pyramidPptx,
  curve: 'image', plane: 'image', quadrant: quadrantPptx, wordart: 'image', chevron: flowPptx, funnel: flowPptx, cycle: flowPptx,
  venn: flowPptx, concentric: flowPptx, emblem: flowPptx, valueChain: flowPptx, bars: 'image', chart: 'image', image: 'image', people: 'image', dots: 'image', math: 'image',
  timeline: timelinePptx, tree: treePptx, states: statesPptx, cause: causePptx, cloud: 'image', gantt: 'image', classes: 'image', bpmn: 'image',
  fta: 'image', status: 'image', bowtie: 'image', comic: 'image', chat: 'image',
} satisfies {[T in LaidOutType]: PptxAdapter<LaidOutOf<T>> | 'image'};

export function bandXml(band: LaidOutBand, ctx: Ctx, index: number): string {
  // the one place the band type and its handler are correlated by hand (lib/emit.ts looks the band up by its definition instead)
  const handler = BAND_HANDLERS[band.type] as PptxAdapter<LaidOutBand> | 'image';
  return (handler === 'image' ? undefined : handler(band, ctx, index)) ?? drawBandFallback(band, ctx, index, () => bandPicture(ctx.ld, band, index), svgShapesXml);
}
