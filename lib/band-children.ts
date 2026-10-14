// Which bands a band holds, as typed tables beside the layout handlers, so the walkers that follow nested bands (connect() collection,
// id lookup, the spotlight, the rules) share one answer instead of each guessing at a `children` property. A band type without an
// entry fails to compile (ChildBandsOf below), and test/band-registries.test.ts checks the tables at run time.

import {IMAGE_PAD, imageSize} from './image.ts';
import type {Band} from './types/index.ts';

type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;
/** One entry per band type: the bands it holds as its `children` (group, row, grouprow, grid, and an image's `over` parts). */
export type ChildBandsTable = {[T in Band['type']]: (band: BandOf<T>) => Band[]};

const none = (): Band[] => [];

export const CHILD_BANDS = {
  spacer: none,
  group: band => band.children,
  sequence: none,
  table: none,
  image: band => band.children ?? [],
  timeline: none,
  bpmn: none,
  classes: none,
  gantt: none,
  cause: none,
  cloud: none,
  states: none,
  tree: none,
  bars: none,
  chart: none,
  people: none,
  dots: none,
  math: none,
  wireframe: none,
  screens: none,
  swimlane: none,
  legend: none,
  connect: none,
  raw: none,
  grouprow: band => band.children,
  row: band => band.children,
  grid: band => band.children,
  pyramid: none,
  plane: none,
  quadrant: none,
  chevron: none,
  funnel: none,
  cycle: none,
  venn: none,
  concentric: none,
  curve: none,
  caption: none,
  box: none,
  banner: none,
} satisfies ChildBandsTable;

/** The bands a band holds as children (none for most types). */
export function childrenOf(band: Band): Band[] {
  return (CHILD_BANDS as ChildBandsTable)[band.type](band as never);
}

/** Like childrenOf, plus a swimlane's steps: every band that sits inside another one. */
export function nestedBandsOf(band: Band): Band[] {
  return band.type === 'swimlane' ? band.steps : childrenOf(band);
}

/**
 * One entry per band type: the width its `children` stack is laid out at when the band itself is `cw` wide, or null when it does not
 * stack them one under the other at one width (a row / grid places them side by side, a grouprow sizes each by its column).
 */
export type StackWidthTable = {[T in Band['type']]: (band: BandOf<T>, cw: number) => number | null};

const noStack = (): null => null;

export const STACK_WIDTH = {
  spacer: noStack,
  group: (band, cw) => cw - 2 * (band.pad ?? 16),
  sequence: noStack,
  table: noStack,
  image: (band, cw) => band.children ? imageSize(band, cw).w - 2 * (band.pad ?? IMAGE_PAD) : null,
  timeline: noStack,
  bpmn: noStack,
  classes: noStack,
  gantt: noStack,
  cause: noStack,
  cloud: noStack,
  states: noStack,
  tree: noStack,
  bars: noStack,
  chart: noStack,
  people: noStack,
  dots: noStack,
  math: noStack,
  wireframe: noStack,
  screens: noStack,
  swimlane: noStack,
  legend: noStack,
  connect: noStack,
  raw: noStack,
  grouprow: noStack,
  row: noStack,
  grid: noStack,
  pyramid: noStack,
  plane: noStack,
  quadrant: noStack,
  chevron: noStack,
  funnel: noStack,
  cycle: noStack,
  venn: noStack,
  concentric: noStack,
  curve: noStack,
  caption: noStack,
  box: noStack,
  banner: noStack,
} satisfies StackWidthTable;

/** The width the children of `band` stack at inside a `cw` wide band, or null (see StackWidthTable). */
export function stackWidthOf(band: Band, cw: number): number | null {
  return (STACK_WIDTH as StackWidthTable)[band.type](band as never, cw);
}
