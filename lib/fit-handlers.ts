// Per-band-type text sizes for minTextSize(): every px size a laid-out band draws its text at, beyond its own wrappedRuns.
// One entry per band type, each checked against its own band type; a band type without one fails to compile.

import type {LaidOutType, LaidOutOf} from './band-table.ts';
import type {LaidOutBand} from './types/index.ts';
import {childRuns, ownRunSizes, sizesOf, texts, textsAndLabels} from './band-text-sizes.ts';
export {ownRunSizes} from './band-text-sizes.ts';

export type TextSizes<B> = (band: B) => Iterable<number>;

const none: TextSizes<unknown> = () => [];
export const FIT_HANDLERS = {
  caption: none,
  status: band => [band.size],
  box: none,
  banner: none,
  group: none,
  legend: none,
  swimlane: none,
  wireframe: none,
  screens: none,
  sequence: none,
  table: band => [band.bodySize],
  row: childRuns,
  grid: childRuns,
  raw: none,
  pyramid: none,
  curve: none,
  plane: band => [band.labelSize],
  quadrant: texts,
  chevron: texts,
  wordart: band => [band.size],
  funnel: texts,
  cycle: texts,
  venn: texts,
  concentric: texts,
  emblem: texts,
  valueChain: texts,
  bars: texts,
  chart: band => [band.size],
  image: band => sizesOf(band.plates),
  people: none,
  dots: none,
  math: none,
  timeline: texts,
  tree: texts,
  states: textsAndLabels,
  cause: texts,
  cloud: band => [...sizesOf(band.texts), ...sizesOf(band.chips)],
  gantt: texts,
  classes: textsAndLabels,
  bpmn: textsAndLabels,
  fta: texts,
  bowtie: texts,
  comic: texts,
} satisfies {[T in LaidOutType]: TextSizes<LaidOutOf<T>>};

/** Band types with no entry in FIT_HANDLERS: must be `never`. */
export type UnfittedBandTypes = Exclude<LaidOutType, keyof typeof FIT_HANDLERS>;
export const ALL_BANDS_FITTED: UnfittedBandTypes extends never ? true : never = true;

/** Every text size one band draws: its own runs, then what its type adds. */
export function bandTextSizes(band: LaidOutBand): number[] {
  return [...ownRunSizes(band), ...(FIT_HANDLERS[band.type] as TextSizes<never> as TextSizes<LaidOutBand>)(band)];
}
