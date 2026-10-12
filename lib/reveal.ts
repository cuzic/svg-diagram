import type {Band, DiagramData} from './types.ts';

type Revealed = {reveal?: number; id?: string};

function checked(value: number | undefined, where: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1) throw new Error(`${where}: reveal must be a whole number >= 1 (got ${value})`);
  return value;
}

const level = (x: Revealed | undefined): number => x?.reveal ?? 0;
const refId = (ref: string): string => ref.split(':')[0];

/** Resolve inheritance once, before the one full layout shared by every stage. */
export function prepareReveal(d: DiagramData): number {
  const ids = new Map<string, number>();
  const connects: Extract<Band, {type: 'connect'}>[] = [];
  let max = 0;
  const set = (x: Revealed, inherited: number, where: string): number => {
    const own = checked(x.reveal, where) ?? 0;
    const n = Math.max(inherited, own);
    if (n) x.reveal = n;
    max = Math.max(max, n);
    if (x.id) ids.set(x.id, n);
    return n;
  };
  const warnings: string[] = [];
  // plane(): each point / line / dim / label / path takes max(the plane's, its own) — and a line / dim / path the later of the
  // points it names (a coordinate counts 0), like a connect(). An explicit reveal earlier than those ends warns.
  const planeElements = (p: Extract<Band, {type: 'plane'}>, n: number): void => {
    const own = (x: {reveal?: number}, where: string) => checked(x.reveal, where);
    const lvl = new Map<string, number>();
    for (const [i, pt] of (p.points ?? []).entries()) {
      const r = Math.max(n, own(pt, `plane() point ${i + 1}`) ?? 0);
      if (r) pt.reveal = r;
      if (pt.id) lvl.set(pt.id, r);
      max = Math.max(max, r);
    }
    const ends = (refs: unknown[]): number => Math.max(0, ...refs.map(r => typeof r === 'string' ? lvl.get(r) ?? 0 : 0));
    const derived = (x: {reveal?: number}, refs: unknown[], where: string, what: string): void => {
      const explicit = own(x, where), e = ends(refs);
      if (explicit !== undefined && explicit < e) warnings.push(`${what} reveal ${explicit} is earlier than an endpoint (reveal ${e})`);
      const r = Math.max(n, explicit ?? e);
      if (r) x.reveal = r;
      max = Math.max(max, r);
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
      max = Math.max(max, ...pa.segReveal);
    }
    for (const [i, d] of (p.dims ?? []).entries()) derived(d, [d.from, d.to], `plane() dim ${i + 1}`, `plane() dim "${d.label}"`);
    for (const [i, l] of (p.labels ?? []).entries()) derived(l, [], `plane() label ${i + 1}`, `plane() label "${l.text}"`);
  };
  const walk = (bands: Band[], inherited = 0): void => {
    for (const b of bands) {
      if (b.type === 'connect') { checked(b.reveal, 'connect()'); connects.push(b); continue; }
      if (b.type === 'legend' || b.type === 'spacer') continue;
      const n = set(b as Revealed, inherited, `${b.type}()`);
      if (b.type === 'group') walk(b.children, n);
      else if (b.type === 'row' || b.type === 'grouprow') {
        const childLevels = b.children.map((c, i) => set(c, n, `row() child ${i + 1}`));
        b.children.forEach((c, i) => { if ('children' in c) walk(c.children, childLevels[i]); }); // a group in a grouprow
        if (b.id) {
          if (b.cols) {
            let next = 1;
            b.children.forEach((c, i) => {
              const span = c.span ?? 1, col = c.col ?? next;
              for (let a = col; a < col + span; a++) ids.set(`${b.id}#${a}`, Math.max(ids.get(`${b.id}#${a}`) ?? 0, childLevels[i]));
              next = col + span;
            });
          } else childLevels.forEach((r, i) => ids.set(`${b.id}#${i + 1}`, r));
        }
      } else if (b.type === 'plane') planeElements(b, n);
      else if (b.type === 'swimlane') b.steps.forEach((c, i) => set(c, n, `swimlane() step ${i + 1}`));
      else if (b.type === 'grid') b.children.forEach((c, i) => set(c, n, `grid() child ${i + 1}`));
      else if (b.type === 'bars') for (const [i, bar] of b.data.entries()) {
        const r = set(bar, n, `bars() value ${i + 1}`);
        if (bar.id) ids.set(bar.id, r);
      }
    }
  };
  walk(d.bands);
  for (const c of connects) {
    const ends = Math.max(ids.get(refId(c.from)) ?? 0, ids.get(refId(c.to)) ?? 0);
    const explicit = c.reveal;
    if (explicit !== undefined && explicit < ends) warnings.push(`connect(${c.from} -> ${c.to}) reveal ${explicit} is earlier than an endpoint (reveal ${ends})`);
    c.reveal = explicit ?? (ends || undefined);
    max = Math.max(max, c.reveal ?? 0);
  }
  d.maxReveal = max;
  d.revealWarnings = warnings;
  return max;
}

export const visibleAt = (x: object & {reveal?: number}, stage: number | undefined): boolean => stage === undefined || (x.reveal ?? 0) <= stage;
