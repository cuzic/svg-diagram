import type {LoopBack} from './types/containers.ts';

const LINES = ['solid', 'dashed', 'dotted'];

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
