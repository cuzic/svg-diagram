// `loopBack` on a row of steps / a horizontal chevron (ADR 0029 D4): the arrow that goes back to an earlier step, drawn under the boxes.
// Written as options of the band; a pre-layout pass turns each into an ordinary connect() with route 'loop-under' right after the band, with the
// lanes stepped so that no two loops cross or run at one height (hand-written loop-under connects keep the `dip` the author wrote).
import {connectBand} from './dsl/defaults.ts';
import {must} from './must.ts';
import {sourceOf, withSource} from './source-ref.ts';
import type {ConnectBand, LoopBack, RowBand} from './types/containers.ts';
import type {ChevronBand} from './flow-shapes.ts';
import type {Band} from './types/index.ts';

const LINES = ['solid', 'dashed', 'dotted'];
/** The height of the first loop under the boxes, and how much each loop outside it adds (px). */
const DIP = 32, LANE = 28;

/**
 * Checks what the author wrote for a band of `n` steps and returns it with every end as a 1-based number. `ids` are the item ids of a chevron, which may
 * also be given instead of a number. Two loops must nest (one span inside the other) or touch at most at an end: partly overlapping spans cross.
 */
export function resolveLoopBacks(who: string, raw: LoopBack | readonly LoopBack[], n: number, ids?: readonly (string | undefined)[]): LoopBack[] {
  const list = Array.isArray(raw) ? raw as readonly LoopBack[] : [raw as LoopBack];
  if (!list.length) throw new Error(`${who}: loopBack is empty (write {from, to} or leave it out)`);
  const end = (v: unknown, name: string): number => {
    if (typeof v === 'string' && ids) {
      const i = ids.indexOf(v);
      if (i < 0) throw new Error(`${who}: loopBack.${name} "${v}" is not an item id of this chevron (${ids.filter(Boolean).join(', ') || 'no item has an id'})`);
      return i + 1;
    }
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > n) throw new Error(`${who}: loopBack.${name} ${JSON.stringify(v)} is not a step (1..${n}${ids ? ', or an item id' : ''})`);
    return v;
  };
  const out = list.map(l => {
    if (typeof l !== 'object' || l === null) throw new Error(`${who}: loopBack takes {from, to, label?} (got ${JSON.stringify(l)})`);
    const from = end(l.from, 'from'), to = end(l.to, 'to');
    if (from <= to) throw new Error(`${who}: loopBack from ${from} must come after to ${to}: a loop goes back (from > to)`);
    if (l.label !== undefined && (typeof l.label !== 'string' || !l.label.trim() || /[\r\n]/.test(l.label))) throw new Error(`${who}: loopBack.label is a non-empty one-line text (got ${JSON.stringify(l.label)})`);
    if (l.line !== undefined && !LINES.includes(l.line)) throw new Error(`${who}: loopBack.line must be solid, dashed or dotted (got ${String(l.line)})`);
    return {...l, from, to};
  });
  for (const [i, a] of out.entries()) for (const b of out.slice(i + 1)) {
    const [al, ah, bl, bh] = [a.to as number, a.from as number, b.to as number, b.from as number];
    if ((al < bl && bl < ah && ah < bh) || (bl < al && al < bh && bh < ah)) throw new Error(`${who}: loopBack ${ah}→${al} and ${bh}→${bl} cross each other; nest them (one span inside the other) or drop one`);
  }
  return out;
}

export interface LoopBackSource {
  loops: LoopBack | readonly LoopBack[];
  anchor(id: string, index: number): string;
}

export function rowLoopBack(row: RowBand): LoopBackSource | undefined {
  if (row.loopBack) return {loops: row.loopBack, anchor: (id, index) => `${id}#${index}`};
  return undefined;
}

export function chevronLoopBack(chevron: ChevronBand): LoopBackSource | undefined {
  if (!chevron.loopBack) return undefined;
  return {loops: chevron.loopBack, anchor(id, index) {
    const step = must(chevron.steps[index - 1]);
    return step.id ?? (step.id = `${id}__${index}`);
  }};
}

/** Turn validated loops into connectors, with shorter spans placed nearer their steps. */
export function loopBackConnectors(
  band: {id?: string}, {loops, anchor}: LoopBackSource, nextId: () => string,
): ConnectBand[] {
  const id = band.id ?? (band.id = nextId());
  const byLane = (Array.isArray(loops) ? loops as readonly LoopBack[] : [loops as LoopBack])
    .toSorted((x, y) => ((x.from as number) - (x.to as number)) - ((y.from as number) - (y.to as number)));
  const ref = sourceOf(band);
  return byLane.map((l, lane) => withSource(Object.assign(connectBand(`${anchor(id, l.from as number)}:bottom`, `${anchor(id, l.to as number)}:bottom`, {
    route: 'loop-under', dip: DIP + lane * LANE, ...(l.label === undefined ? {} : {label: l.label}), ...(l.chip === undefined ? {} : {chip: l.chip}), ...(l.tone === undefined ? {} : {tone: l.tone}), ...(l.line === undefined ? {} : {line: l.line}),
  }, false), {loopBack: true as const}), ref));
}

/** Insert generated connectors immediately after their source in the complete renderer. */
export function expandLoopBacks(bands: Band[]): Band[] {
  let internal = 0;
  const visit = (list: Band[]): Band[] => list.flatMap(band => {
    if (band.type === 'group') band.children = visit(band.children);
    if (band.type === 'row' || band.type === 'chevron') {
      const source = band.type === 'row' ? rowLoopBack(band) : chevronLoopBack(band);
      if (source) return [band, ...loopBackConnectors(band, source, () => `__loopback${internal++}`)];
    }
    return [band];
  });
  return visit(bands);
}
