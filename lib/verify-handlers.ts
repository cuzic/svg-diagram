// Rectangles used by the CLI's placed-part location map (ADR 0072 D6).
import {sourceOf} from './source-ref.ts';
import {scopeOf} from './scope-name.ts';
import {barsRects} from './verify-bars.ts';
import {bowtieRects} from './verify-bowtie-rects.ts';
import {captionRects} from './verify-caption.ts';
import {cloudRects} from './verify-cloud.ts';
import {comicRects} from './verify-comic-rects.ts';
import {ftaRects} from './verify-fta-rects.ts';
import {imageRects} from './verify-image.ts';
import {childRects, emblemRects, figureRects, frameRects, overlappingFigureRects, ownRect, scopedRect, statusRects} from './verify-rects.ts';
import {treeRects} from './verify-tree.ts';
import type {LaidOutOf, LaidOutType} from './band-table.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {CheckRect} from './types/verdicts.ts';

export interface VerifyHandler<B> {
  rects?(band: B): CheckRect[];
}

const holdsFigure = (band: {id?: string}) => band.id ? {holds: [band.id]} : {};

export const VERIFY_HANDLERS = {
  caption: {rects: captionRects},
  box: {rects: ownRect},
  banner: {rects: ownRect},
  group: {},
  legend: {rects: ownRect},
  row: {rects: childRects},
  grid: {rects: childRects},
  raw: {rects: ownRect},
  status: {rects: statusRects},
  pyramid: {rects: ownRect},
  curve: {rects: ownRect},
  plane: {rects: ownRect},
  bars: {rects: barsRects},
  chart: {
    rects: band => band.anchors.map(a => ({id: a.id, label: a.id, x: a.x, y: a.y, w: a.w, h: a.h, ...holdsFigure(band)})), // each bar / cell / node with an id is its own rect: a connector from outside must not run through one
  },
  image: {rects: imageRects},
  people: {rects: ownRect},
  dots: {rects: ownRect},
  math: {rects: ownRect},
  quadrant: {rects: figureRects},
  chevron: {rects: figureRects},
  wordart: {rects: ownRect},
  funnel: {rects: figureRects},
  cycle: {rects: figureRects},
  venn: {rects: overlappingFigureRects},
  concentric: {rects: overlappingFigureRects},
  emblem: {rects: emblemRects},
  valueChain: {rects: figureRects},
  timeline: {rects: ownRect},
  bowtie: {rects: bowtieRects},
  comic: {rects: comicRects},
  fta: {rects: ftaRects},
  tree: {rects: treeRects},
  states: {rects: figureRects},
  cause: {rects: figureRects},
  cloud: {rects: cloudRects},
  gantt: {rects: figureRects},
  classes: {rects: figureRects},
  bpmn: {rects: figureRects},
  swimlane: {},
  sequence: {rects: ownRect},
  table: {rects: ownRect},
  wireframe: {rects: ownRect},
  screens: {rects: frameRects},
} satisfies {[T in LaidOutType]: VerifyHandler<LaidOutOf<T>>};

/** Band types with no entry in VERIFY_HANDLERS: must be `never`. */
export type UnverifiedBandTypes = Exclude<LaidOutType, keyof typeof VERIFY_HANDLERS>;
export const ALL_BANDS_VERIFIED: UnverifiedBandTypes extends never ? true : never = true;

const handlerOf = (band: LaidOutDiagram['laidOut'][number]): VerifyHandler<LaidOutDiagram['laidOut'][number]> => VERIFY_HANDLERS[band.type] as VerifyHandler<never> as VerifyHandler<LaidOutDiagram['laidOut'][number]>;

/** Every checkable rect, in band order. */
export function collectRects(d: LaidOutDiagram): CheckRect[] {
  return d.laidOut.flatMap(band => {
    // comicRects names panels and slots explicitly: a bare band id can have the same spelling as either.
    const scope = band.type === 'comic' ? undefined : scopeOf(band), loc = sourceOf(band);
    const rects = (handlerOf(band).rects?.(band) ?? []).map(r => loc && !r.loc ? {...r, loc} : r);
    return scope ? rects.map(r => scopedRect(band, scope, r)) : rects;
  });
}
