// The minimal cut sets of a fault tree (ADR 0025 D4, U2): MOCUS, bottom-up, on a coherent tree (no NOT, no exclusive OR).
// A pure function of the resolved tree; no layout, no fonts. A repeated event (`ref`) is the same variable as the event it repeats.
import type {FtaNode} from './fta.ts';

/** More sets than this at any step (counted before absorption, which is where they grow first) and the analysis stops. */
export const CUT_SET_LIMIT = 5000;

export interface CutSets {
  /** The minimal cut sets, each a sorted list of variables; smallest first. Empty when `truncated`. */
  sets: string[][];
  truncated: boolean;
}

/** The variable a leaf stands for: a repeat shares the variable of the event it repeats. */
export const ftaVar = (n: Pick<FtaNode, 'key' | 'id' | 'copyOf'>): string => n.copyOf ?? n.id ?? n.key;

class TooMany extends Error {}

const union = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])].sort();
const subset = (a: string[], b: string[]): boolean => a.length <= b.length && a.every(v => b.includes(v));

/** Keeps the sets no other set is contained in (a set repeated counts once). */
function absorb(sets: string[][]): string[][] {
  const sorted = [...new Map(sets.map(s => [s.join('\u0000'), s])).values()].sort((a, b) => a.length - b.length);
  const out: string[][] = [];
  for (const s of sorted) if (!out.some(o => subset(o, s))) out.push(s);
  return out;
}

const guard = (n: number): void => { if (n > CUT_SET_LIMIT) throw new TooMany(); };

function and(parts: string[][][]): string[][] {
  let acc: string[][] = [[]];
  for (const p of parts) {
    guard(acc.length * p.length);
    acc = absorb(acc.flatMap(a => p.map(b => union(a, b))));
  }
  return acc;
}

function choose<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const go = (from: number, picked: T[]): void => {
    if (picked.length === k) { out.push(picked); return; }
    for (let i = from; i < items.length; i++) { go(i + 1, [...picked, items[i]]); guard(out.length); }
  };
  go(0, []);
  return out;
}

/** The sets of one event: [] = never happens, [[]] = always happens. */
function setsOf(n: FtaNode): string[][] {
  if (n.gate === undefined) {
    if (n.kind === 'house') return n.state ? [[]] : [];
    return [[ftaVar(n)]];
  }
  const kids = n.children.map(setsOf);
  if (n.gate === 'or') { guard(kids.reduce((s, k) => s + k.length, 0)); return absorb(kids.flat()); }
  if (n.gate === 'and') return and(kids);
  if (n.gate === 'inhibit') return and([...kids, setsOf(n.cond!)]);
  const combos = choose(kids, n.k!); // vote(k, n): an AND for each way to pick k of the n inputs
  guard(combos.length);
  return absorb(combos.flatMap(c => and(c)));
}

/** The minimal cut sets of the tree. `truncated` when a step passed CUT_SET_LIMIT (then `sets` is empty: nothing is guessed). */
export function minimalCutSets(root: FtaNode): CutSets {
  try {
    const sets = absorb(setsOf(root)).sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
    return {sets, truncated: false};
  } catch (e) {
    if (e instanceof TooMany) return {sets: [], truncated: true};
    throw e;
  }
}

/** The variables that alone bring the top event about (the cut sets of size 1). */
export function singlePoints(cuts: CutSets): Set<string> {
  return new Set(cuts.sets.filter(s => s.length === 1).map(s => s[0]));
}
