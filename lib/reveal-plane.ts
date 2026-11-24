import {checked} from './reveal-visibility.ts';
import {warnEarlyReveal} from './reveal-warnings.ts';
import type {PlaneBand} from './types/figures.ts';

// plane(): each point / line / dim / label / path takes max(the plane's, its own) — and a line / dim / path the later of the
// points it names (a coordinate counts 0), like a connect(). An explicit reveal earlier than those ends warns.
export function revealPlane(p: PlaneBand, n: number): {last: number; warnings: string[]} {
  let last = n;
  const warnings: string[] = [];
  const own = (x: {reveal?: number}, where: string) => checked(x.reveal, where);
  const lvl = new Map<string, number>();
  for (const [i, pt] of (p.points ?? []).entries()) {
    const r = Math.max(n, own(pt, `plane() point ${i + 1}`) ?? 0);
    if (r) pt.reveal = r;
    if (pt.id) lvl.set(pt.id, r); // a plane's points are its own: the lines and dims of the same plane name them
    last = Math.max(last, r);
  }
  const ends = (refs: unknown[]): number => Math.max(0, ...refs.map(r => typeof r === 'string' ? lvl.get(r) ?? 0 : 0));
  const derived = (x: {reveal?: number}, refs: unknown[], where: string, what: string): void => {
    const explicit = own(x, where), e = ends(refs);
    warnEarlyReveal(warnings, what, explicit, e);
    const r = Math.max(n, explicit ?? e);
    if (r) x.reveal = r;
    last = Math.max(last, r);
  };
  for (const [i, l] of (p.lines ?? []).entries()) derived(l, [l.from, l.to], `plane() line ${i + 1}`, `plane() line ${i + 1} (${l.from} -> ${l.to})`);
  for (const [i, pa] of (p.paths ?? []).entries()) {
    if (!pa.grow) { derived(pa, pa.through, `plane() path ${i + 1}`, `plane() path ${i + 1}`); continue; }
    // a growing path: piece k appears with the later of the points it runs between (and everything before it, so the curve only grows)
    const lv = pa.through.map(r => typeof r === 'string' ? lvl.get(r) ?? 0 : 0);
    const explicit = own(pa, `plane() path ${i + 1}`) ?? 0;
    let run = Math.max(n, explicit, lv[0] ?? 0);
    pa.segReveal = pa.through.slice(1).map((_r, k) => (run = Math.max(run, lv[k + 1] ?? 0)));
    if (pa.segReveal[0]) pa.reveal = pa.segReveal[0]; else delete pa.reveal;
    last = Math.max(last, ...pa.segReveal);
  }
  for (const [i, d] of (p.dims ?? []).entries()) derived(d, [d.from, d.to], `plane() dim ${i + 1}`, `plane() dim "${d.label}"`);
  for (const [i, l] of (p.labels ?? []).entries()) derived(l, [], `plane() label ${i + 1}`, `plane() label "${l.text}"`);
  return {last, warnings};
}
