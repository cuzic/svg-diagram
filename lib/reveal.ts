import {nodeIdsOf} from './band-ids.ts';
import {checked, earlier, revealHandlerFor} from './reveal-handlers.ts';
import type {Revealed, RevealCtx} from './reveal-handlers.ts';
import type {DiagramData} from './types/core.ts';
import type {Band} from './types/index.ts';

const refId = (ref: string): string => ref.split(':')[0];

/** Resolve inheritance once, before the one full layout shared by every stage. The per-band-type parts live in reveal-handlers.ts. */
export function prepareReveal(d: DiagramData): number {
  const ctx: RevealCtx = {
    ids: new Map(), untils: new Map(), ownUntils: new Map(), replaced: new Set(), warnings: [], connects: [], max: 0,
    set(x, inherited, where, inheritedUntil) {
      const own = checked(x.reveal, where) ?? 0;
      const n = Math.max(inherited, own);
      if (n) x.reveal = n;
      const u = earlier(inheritedUntil, checked(x.until, `${where} (until)`));
      if (u !== undefined) {
        if (u <= n) throw new Error(`${where}: until ${u} must be later than its reveal ${n || '(shown from the start)'}`);
        x.until = u;
        ctx.max = Math.max(ctx.max, u);
        if (x.id) ctx.untils.set(x.id, u);
      }
      ctx.max = Math.max(ctx.max, n);
      if (x.id) ctx.ids.set(x.id, n);
      return n;
    },
    walk(bands: Band[], inherited = 0, until?: number): void {
      for (const b of bands) {
        const h = revealHandlerFor(b);
        if (!h.stage) { h.visit?.(b as never, ctx); continue; }
        const n = ctx.set(b as Revealed, inherited, `${b.type}()`, until);
        const u = (b as Revealed).until;
        for (const id of nodeIdsOf(b)) { ctx.ids.set(id, n); if (u !== undefined) ctx.untils.set(id, u); } // the nodes of a self-placing figure come and go with it
        h.visit?.(b as never, n, u, ctx);
      }
    },
  };
  const {ids, untils, warnings, connects} = ctx;
  ctx.walk(d.bands);
  let max = ctx.max;
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
