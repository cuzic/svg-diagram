import type {Band, DiagramData} from './types.ts';

type Revealed = {reveal?: number; until?: number; id?: string};

function checked(value: number | undefined, where: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1) throw new Error(`${where}: reveal must be a whole number >= 1 (got ${value})`);
  return value;
}

// `until`: the click an element vanishes at (a group's until takes its children with it). It must come after the reveal it ends up with.
const earlier = (a: number | undefined, b: number | undefined): number | undefined => a === undefined ? b : b === undefined ? a : Math.min(a, b);

const level = (x: Revealed | undefined): number => x?.reveal ?? 0;
const refId = (ref: string): string => ref.split(':')[0];

/** Resolve inheritance once, before the one full layout shared by every stage. */
export function prepareReveal(d: DiagramData): number {
  const ids = new Map<string, number>();
  const untils = new Map<string, number>();
  const ownUntils = new Map<object, number | undefined>(), replaced = new Set<string>();
  const connects: Extract<Band, {type: 'connect'}>[] = [];
  let max = 0;
  const set = (x: Revealed, inherited: number, where: string, inheritedUntil?: number): number => {
    const own = checked(x.reveal, where) ?? 0;
    const n = Math.max(inherited, own);
    if (n) x.reveal = n;
    const u = earlier(inheritedUntil, checked(x.until, `${where} (until)`));
    if (u !== undefined) {
      if (u <= n) throw new Error(`${where}: until ${u} must be later than its reveal ${n || '(shown from the start)'}`);
      x.until = u;
      max = Math.max(max, u);
      if (x.id) untils.set(x.id, u);
    }
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
  const walk = (bands: Band[], inherited = 0, until?: number): void => {
    for (const b of bands) {
      if (b.type === 'connect') { checked(b.reveal, 'connect()'); checked(b.until, 'connect() (until)'); connects.push(b); continue; }
      if (b.type === 'legend' || b.type === 'spacer') continue;
      const n = set(b as Revealed, inherited, `${b.type}()`, until);
      const u = (b as Revealed).until;
      if (b.type === 'group') walk(b.children, n, u);
      else if (b.type === 'row' || b.type === 'grouprow') {
        const childLevels = b.children.map((c, i) => set(c, n, `row() child ${i + 1}`, u));
        b.children.forEach((c, i) => { if ('children' in c) walk(c.children, childLevels[i], c.until); }); // a group in a grouprow
        if (b.id) {
          // row#k: the stage its cell appears at and the stage it vanishes at (the latest of its children; none if any child stays)
          const slotUntil = new Map<string, number>(), stays = new Set<string>();
          const cell = (key: string, r: number, until: number | undefined): void => {
            ids.set(key, Math.max(ids.get(key) ?? 0, r));
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
          for (const [key, u] of slotUntil) if (!stays.has(key)) untils.set(key, u);
        }
      } else if (b.type === 'plane') planeElements(b, n);
      else if (b.type === 'swimlane') b.steps.forEach((c, i) => set(c, n, `swimlane() step ${i + 1}`, u));
      else if (b.type === 'grid') b.children.forEach((c, i) => set(c, n, `grid() child ${i + 1}`, u));
      else if (b.type === 'bars') for (const [i, bar] of b.data.entries()) {
        ownUntils.set(bar, bar.until); // the bar's own, before set() merges in the band's
        if (bar.replaces !== undefined) {
          if (b.stack) throw new Error(`bars() value ${i + 1}: replaces does not work with stack (the segments share one bar)`);
          const old = b.data.slice(0, i).find(d => d.id === bar.replaces);
          if (!old) throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}" must name the id of an earlier bar of the same band`);
          if (bar.reveal === undefined) throw new Error(`bars() value ${i + 1}: a bar that replaces another needs a reveal (the click it takes the place at)`);
          if (replaced.has(bar.replaces)) throw new Error(`bars() value ${i + 1}: "${bar.replaces}" is already replaced by another bar`);
          replaced.add(bar.replaces);
          const oldOwn = ownUntils.get(old);
          if (oldOwn !== undefined && oldOwn !== bar.reveal) throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}", which already vanishes at ${oldOwn}, not at this bar's reveal ${bar.reveal}`);
          if (bar.reveal <= (old.reveal ?? 0)) throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}" but is revealed (${bar.reveal}) no later than it (${old.reveal ?? 0})`);
          if (old.id) untils.set(old.id, bar.reveal);
          old.until = bar.reveal; // the replaced bar goes at the very click its replacement comes
        }
        const r = set(bar, n, `bars() value ${i + 1}`, u);
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
    // a connector goes with the first of its ends to vanish
    const gone = c.until ?? earlier(untils.get(refId(c.from)), untils.get(refId(c.to)));
    if (gone !== undefined) {
      const ends2 = earlier(untils.get(refId(c.from)), untils.get(refId(c.to)));
      if (c.until !== undefined && ends2 !== undefined && c.until > ends2) warnings.push(`connect(${c.from} -> ${c.to}) until ${c.until} is later than an endpoint's (vanishes at ${ends2})`);
      if (gone <= (c.reveal ?? 0)) throw new Error(`connect(${c.from} -> ${c.to}): until ${gone} must be later than its reveal ${c.reveal ?? '(shown from the start)'} (an arrow between two things that are never on screen together has nothing to show)`);
      c.until = gone;
      max = Math.max(max, gone);
    }
  }
  d.maxReveal = max;
  d.revealWarnings = warnings;
  return max;
}

export const visibleAt = (x: object & {reveal?: number; until?: number}, stage: number | undefined): boolean =>
  stage === undefined || ((x.reveal ?? 0) <= stage && (x.until === undefined || stage < x.until));
