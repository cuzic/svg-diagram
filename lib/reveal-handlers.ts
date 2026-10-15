// Per-band-type reveal resolution (prepareReveal's walk): what a band type adds to the click-stage bookkeeping beyond its own
// reveal / until: its children, row slot ids, a plane's elements, an image's marks, a bars value's `replaces`.
// One entry per band type, each checked against its own band type; a band type without one fails to compile
// (UnrevealedBandTypes), and test/reveal-handlers.test.ts checks the table at run time.

import {childrenOf} from './band-children.ts';
import type {Band} from './types/index.ts';

type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;

export type Revealed = {reveal?: number; until?: number; id?: string};

export function checked(value: number | undefined, where: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1) throw new Error(`${where}: reveal must be a whole number >= 1 (got ${value})`);
  return value;
}

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

// plane(): each point / line / dim / label / path takes max(the plane's, its own) — and a line / dim / path the later of the
// points it names (a coordinate counts 0), like a connect(). An explicit reveal earlier than those ends warns.
function revealPlane(p: BandOf<'plane'>, n: number, _u: number | undefined, ctx: RevealCtx): void {
  const own = (x: {reveal?: number}, where: string) => checked(x.reveal, where);
  const lvl = new Map<string, number>();
  for (const [i, pt] of (p.points ?? []).entries()) {
    const r = Math.max(n, own(pt, `plane() point ${i + 1}`) ?? 0);
    if (r) pt.reveal = r;
    if (pt.id) lvl.set(pt.id, r); // a plane's points are its own: the lines and dims of the same plane name them
    ctx.max = Math.max(ctx.max, r);
  }
  const ends = (refs: unknown[]): number => Math.max(0, ...refs.map(r => typeof r === 'string' ? lvl.get(r) ?? 0 : 0));
  const derived = (x: {reveal?: number}, refs: unknown[], where: string, what: string): void => {
    const explicit = own(x, where), e = ends(refs);
    if (explicit !== undefined && explicit < e) ctx.warnings.push(`${what} reveal ${explicit} is earlier than an endpoint (reveal ${e})`);
    const r = Math.max(n, explicit ?? e);
    if (r) x.reveal = r;
    ctx.max = Math.max(ctx.max, r);
  };
  for (const [i, l] of (p.lines ?? []).entries()) derived(l, [l.from, l.to], `plane() line ${i + 1}`, `plane() line ${i + 1} (${l.from} -> ${l.to})`);
  for (const [i, pa] of (p.paths ?? []).entries()) {
    if (!pa.grow) { derived(pa, pa.through, `plane() path ${i + 1}`, `plane() path ${i + 1}`); continue; }
    // a growing path: piece k appears with the later of the points it runs between (and everything before it, so the curve only grows)
    const lv = pa.through.map(r => typeof r === 'string' ? lvl.get(r) ?? 0 : 0);
    const explicit = own(pa, `plane() path ${i + 1}`) ?? 0;
    let run = Math.max(n, explicit, lv[0] ?? 0);
    pa.segReveal = pa.through.slice(1).map((_r, k) => (run = Math.max(run, lv[k + 1])));
    if (pa.segReveal[0]) pa.reveal = pa.segReveal[0]; else delete pa.reveal;
    ctx.max = Math.max(ctx.max, ...pa.segReveal);
  }
  for (const [i, d] of (p.dims ?? []).entries()) derived(d, [d.from, d.to], `plane() dim ${i + 1}`, `plane() dim "${d.label}"`);
  for (const [i, l] of (p.labels ?? []).entries()) derived(l, [], `plane() label ${i + 1}`, `plane() label "${l.text}"`);
}

// row / grouprow: the children are cells (set, not walked), a group in a grouprow is walked, and `row#k` ids name the slots.
function revealRow(b: BandOf<'row'> | BandOf<'grouprow'>, n: number, u: number | undefined, ctx: RevealCtx): void {
  const childLevels = b.children.map((c, i) => ctx.set(c, n, `row() child ${i + 1}`, u));
  b.children.forEach((c, i) => { if ('children' in c) ctx.walk(c.children, childLevels[i], c.until); }); // a group in a grouprow
  if (!b.id) return;
  // row#k: the stage its cell appears at and the stage it vanishes at (the latest of its children; none if any child stays)
  const slotUntil = new Map<string, number>(), stays = new Set<string>();
  const cell = (key: string, r: number, until: number | undefined): void => {
    ctx.ids.set(key, Math.max(ctx.ids.get(key) ?? 0, r));
    if (until === undefined) stays.add(key); else slotUntil.set(key, Math.max(slotUntil.get(key) ?? 0, until));
  };
  if (b.cols) {
    let next = 1;
    b.children.forEach((c, i) => {
      const span = c.span ?? 1, col = c.col ?? next;
      for (let a = col; a < col + span; a++) cell(`${b.id}#${a}`, childLevels[i], c.until);
      next = col + span;
    });
  } else b.children.forEach((c, i) => cell(`${b.id}#${i + 1}`, childLevels[i], c.until));
  for (const [key, un] of slotUntil) if (!stays.has(key)) ctx.untils.set(key, un);
}

function revealImage(b: BandOf<'image'>, n: number, u: number | undefined, ctx: RevealCtx): void {
  for (const [i, m] of (b.marks ?? []).entries()) { const r = ctx.set(m, n, `image() mark ${i + 1}`, u); if (m.id) ctx.ids.set(ctx.name(m.id), r); }
  for (const [i, l] of (b.labels ?? []).entries()) ctx.set(l, n, `image() label ${i + 1}`, u);
  ctx.walk(childrenOf(b), n, u);
}

// bars: each value is an element; `replaces` ends an earlier bar at the very click its replacement comes.
function revealBars(b: BandOf<'bars'>, n: number, u: number | undefined, ctx: RevealCtx): void {
  for (const [i, bar] of b.data.entries()) {
    ctx.ownUntils.set(bar, bar.until); // the bar's own, before set() merges in the band's
    if (bar.replaces !== undefined) {
      if (b.stack) throw new Error(`bars() value ${i + 1}: replaces does not work with stack (the segments share one bar)`);
      const old = b.data.slice(0, i).find(d => d.id === bar.replaces);
      if (!old) throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}" must name the id of an earlier bar of the same band`);
      if (bar.reveal === undefined) throw new Error(`bars() value ${i + 1}: a bar that replaces another needs a reveal (the click it takes the place at)`);
      if (ctx.replaced.has(ctx.name(bar.replaces))) throw new Error(`bars() value ${i + 1}: "${bar.replaces}" is already replaced by another bar`);
      ctx.replaced.add(ctx.name(bar.replaces));
      const oldOwn = ctx.ownUntils.get(old);
      if (oldOwn !== undefined && oldOwn !== bar.reveal) throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}", which already vanishes at ${oldOwn}, not at this bar's reveal ${bar.reveal}`);
      if (bar.reveal <= (old.reveal ?? 0)) throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}" but is revealed (${bar.reveal}) no later than it (${old.reveal ?? 0})`);
      if (old.id) ctx.untils.set(ctx.name(old.id), bar.reveal);
      old.until = bar.reveal; // the replaced bar goes at the very click its replacement comes
    }
    const r = ctx.set(bar, n, `bars() value ${i + 1}`, u);
    if (bar.id) ctx.ids.set(ctx.name(bar.id), r);
  }
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
  group: nested,
  sequence: plain,
  table: plain,
  image: {stage: true, visit: revealImage},
  timeline: plain,
  bpmn: plain,
  classes: plain,
  gantt: plain,
  cause: plain,
  cloud: plain,
  states: plain,
  tree: plain,
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
  row: {stage: true, visit: revealRow},
  // grid() takes box() children only (its constructor rejects a group), and a box holds no bands: nothing nested to walk, so each
  // cell is just set (test/grid-reveal-nested.test.ts pins this)
  grid: setEach('grid() child', (b: BandOf<'grid'>) => b.children),
  pyramid: plain,
  plane: {stage: true, visit: revealPlane},
  quadrant: plain,
  chevron: plain,
  wordart: plain,
  funnel: plain,
  cycle: plain,
  venn: plain,
  concentric: plain,
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
