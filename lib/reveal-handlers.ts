// Per-band-type reveal resolution (prepareReveal's walk): what a band type adds to the click-stage bookkeeping beyond its own
// reveal / until: its children, row slot ids, a plane's elements, an image's marks, a bars value's `replaces`.
// One entry per band type, each checked against its own band type; a band type without one fails to compile
// (UnrevealedBandTypes), and test/reveal-handlers.test.ts checks the table at run time.

import {childrenOf} from './band-children.ts';
import {revealBars} from './reveal-bars.ts';
import {revealPlane} from './reveal-plane.ts';
import {rowSlotStages} from './reveal-row.ts';
import type {Band} from './types/index.ts';

type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;

export type Revealed = {reveal?: number; until?: number; id?: string};

import {checked} from './reveal-visibility.ts';
export {checked} from './reveal-visibility.ts';

// `until`: the click an element vanishes at (a group's until takes its children with it). It must come after the reveal it ends up with.
export const earlier = (a: number | undefined, b: number | undefined): number | undefined => a === undefined ? b : b === undefined ? a : Math.min(a, b);

/** The state one prepareReveal() run threads through its handlers. */
export interface RevealCtx {
  /** element / node id -> the stage it appears at */
  ids: Map<string, number>;
  /** element / node id -> the stage it vanishes at */
  untils: Map<string, number>;
  /** a bar's own `until`, as written (before the band's is merged in) */
  ownUntils: Map<object, number | undefined>;
  /** ids of bars that another bar already replaces */
  replaced: Set<string>;
  warnings: string[];
  connects: BandOf<'connect'>[];
  /** the largest stage (or until) seen so far */
  max: number;
  /** The `scope` of the band whose items are being visited (ADR 0012); undefined for the band itself and for unscoped bands. */
  scope?: string;
  /** The name an item id is registered under: `scope.id` inside a scoped band, the id itself elsewhere. */
  name(id: string): string;
  /** Resolve one element: max(inherited, own) reveal, earliest until; records its id. Returns its stage. */
  set(x: Revealed, inherited: number, where: string, inheritedUntil?: number): number;
  /** Walk nested bands with an inherited stage / until. */
  walk(bands: Band[], inherited?: number, until?: number): void;
}

/**
 * How a band type takes part in the walk. `stage: false`: it has no reveal of its own (a connect() is resolved last, from the
 * stages of its ends; a legend / spacer never reveals) and only `visit` runs. `stage: true`: the band itself is resolved first
 * (n = its stage, u = its until) and then `visit` handles what it holds.
 */
export type RevealHandler<B> =
  | {stage: false; visit?(band: B, ctx: RevealCtx): void}
  | {stage: true; visit?(band: B, n: number, u: number | undefined, ctx: RevealCtx): void};
export type BandRevealHandlers = {[T in Band['type']]: RevealHandler<BandOf<T>>};

const plain: RevealHandler<never> = {stage: true};
/** A band whose nested bands (childrenOf) inherit its stage and until. */
const nested: RevealHandler<Band> = {stage: true, visit: (b, n, u, ctx) => ctx.walk(childrenOf(b), n, u)};
const unrevealed: RevealHandler<never> = {stage: false};

// row / grouprow: the children are cells (set, not walked), a group in a grouprow is walked, and `row#k` ids name the slots.
function revealRow(b: BandOf<'row'> | BandOf<'grouprow'>, n: number, u: number | undefined, ctx: RevealCtx): void {
  const childLevels = b.children.map((c, i) => ctx.set(c, n, `row() child ${i + 1}`, u));
  b.children.forEach((c, i) => { if ('children' in c) ctx.walk(c.children, childLevels[i], c.until); }); // a group in a grouprow
  for (const [key, {start, end}] of rowSlotStages(b)) {
    ctx.ids.set(key, Math.max(ctx.ids.get(key) ?? 0, start));
    if (end !== undefined) ctx.untils.set(key, end);
  }
}

// areas: like a row, the cells are set (each named area carries its own reveal) and a group in a cell is walked
function revealAreas(b: BandOf<'areas'>, n: number, u: number | undefined, ctx: RevealCtx): void {
  b.children.forEach((c, i) => {
    const level = ctx.set(c, n, `areas() area "${b.names[i]}"`, u);
    if (c.type === 'group') ctx.walk(c.children, level, c.until);
  });
}

function revealImage(b: BandOf<'image'>, n: number, u: number | undefined, ctx: RevealCtx): void {
  for (const [i, m] of (b.marks ?? []).entries()) { const r = ctx.set(m, n, `image() mark ${i + 1}`, u); if (m.id) ctx.ids.set(ctx.name(m.id), r); }
  for (const [i, l] of (b.labels ?? []).entries()) ctx.set(l, n, `image() label ${i + 1}`, u);
  ctx.walk(childrenOf(b), n, u);
}

const setEach = (what: string, items: (b: never) => Revealed[]) => ({
  stage: true as const,
  visit: (b: never, n: number, u: number | undefined, ctx: RevealCtx): void => items(b).forEach((c, i) => ctx.set(c, n, `${what} ${i + 1}`, u)),
});

/**
 * The handler of every band type. Typed per key (the `satisfies` below), so each is checked against its own band type;
 * UnrevealedBandTypes makes a band type without one a compile error.
 */
export const REVEAL_HANDLERS = {
  spacer: unrevealed,
  status: unrevealed,
  group: nested,
  sequence: plain,
  table: plain,
  image: {stage: true, visit: revealImage},
  timeline: plain,
  bpmn: plain,
  fta: plain,
  bowtie: plain,
  comic: plain,
  classes: plain,
  gantt: plain,
  cause: plain,
  cloud: plain,
  states: plain,
  tree: nested, // a band node takes the tree's stage and until
  bars: {stage: true, visit: revealBars},
  chart: plain,
  people: plain,
  dots: plain,
  math: plain,
  wireframe: plain,
  screens: plain,
  swimlane: setEach('swimlane() step', (b: BandOf<'swimlane'>) => b.steps),
  legend: unrevealed,
  // a connect() is resolved last, from the stages of its ends (see prepareReveal)
  connect: {
    stage: false,
    visit: (b, ctx) => { checked(b.reveal, 'connect()'); checked(b.until, 'connect() (until)'); ctx.connects.push(b); },
  },
  raw: plain,
  grouprow: {stage: true, visit: revealRow},
  areas: {stage: true, visit: revealAreas},
  row: {stage: true, visit: revealRow},
  // grid() takes box() children only (its constructor rejects a group), and a box holds no bands: nothing nested to walk, so each
  // cell is just set (test/grid-reveal-nested.test.ts pins this)
  grid: setEach('grid() child', (b: BandOf<'grid'>) => b.children),
  pyramid: plain,
  plane: {stage: true, visit(p, n, _u, ctx) {
    const {last, warnings} = revealPlane(p, n);
    ctx.max = Math.max(ctx.max, last);
    ctx.warnings.push(...warnings);
  }},
  quadrant: plain,
  chevron: plain,
  wordart: plain,
  funnel: plain,
  cycle: plain,
  venn: plain,
  concentric: plain,
  emblem: plain,
  valueChain: plain,
  curve: plain,
  caption: plain,
  box: plain,
  banner: plain,
} satisfies BandRevealHandlers;

/** Band types with no handler in REVEAL_HANDLERS: must be `never`, so adding a band type without one fails to compile. */
export type UnrevealedBandTypes = Exclude<Band['type'], keyof typeof REVEAL_HANDLERS>;
export const ALL_BANDS_REVEALED: UnrevealedBandTypes extends never ? true : never = true;

export function revealHandlerFor(band: Band): RevealHandler<never> {
  return (REVEAL_HANDLERS as BandRevealHandlers)[band.type] as RevealHandler<never>;
}
