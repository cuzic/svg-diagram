// Per-band-type text sizes for minTextSize(): every px size a laid-out band draws its text at, beyond its own wrappedRuns.
// One entry per band type, each checked against its own band type; a band type without one fails to compile.

import type {LaidOutType, LaidOutOf} from './band-table.ts';
import type {LaidOutBand} from './types/index.ts';
import type {WrappedRun} from './types/text-bands.ts';

export type TextSizes<B> = (band: B) => Iterable<number>;

const none: TextSizes<unknown> = () => [];
const sizesOf = (xs: readonly {size: number}[]): number[] => xs.map(x => x.size);
const runSizes = (runs: readonly WrappedRun[]): number[] => runs.map(r => r.size);
/** A band's own text runs (what box / caption / banner carry); any band that has them. */
export const ownRunSizes = (band: LaidOutBand): number[] => 'wrappedRuns' in band ? runSizes(band.wrappedRuns) : [];
const childRuns = (band: {children: readonly {wrappedRuns: WrappedRun[]}[]}): number[] => band.children.flatMap(c => runSizes(c.wrappedRuns));
const texts: TextSizes<{texts: readonly {size: number}[]}> = band => sizesOf(band.texts);
const textsAndLabels: TextSizes<{texts: readonly {size: number}[]; labels: readonly {size: number}[]}> = band => [...sizesOf(band.texts), ...sizesOf(band.labels)];

export const FIT_HANDLERS = {
  caption: none,
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
  funnel: texts,
  cycle: texts,
  venn: texts,
  concentric: texts,
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
} satisfies {[T in LaidOutType]: TextSizes<LaidOutOf<T>>};

/** Band types with no entry in FIT_HANDLERS: must be `never`. */
export type UnfittedBandTypes = Exclude<LaidOutType, keyof typeof FIT_HANDLERS>;
export const ALL_BANDS_FITTED: UnfittedBandTypes extends never ? true : never = true;

/** Every text size one band draws: its own runs, then what its type adds. */
export function bandTextSizes(band: LaidOutBand): number[] {
  return [...ownRunSizes(band), ...(FIT_HANDLERS[band.type] as TextSizes<never> as TextSizes<LaidOutBand>)(band)];
}
