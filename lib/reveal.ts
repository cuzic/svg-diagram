import {scopeOf, scopesOf} from './anchor-scope.ts';
import {nodeIdsOf} from './band-ids.ts';
import {checked, earlier, revealHandlerFor} from './reveal-handlers.ts';
import type {Revealed, RevealCtx} from './reveal-handlers.ts';
import type {DiagramData} from './types/core.ts';
import type {Band} from './types/index.ts';
import {atBand} from './source-ref.ts';
import {resolveRevealId, warnConnectorReveal} from './reveal-warnings.ts';

/** Resolve inheritance once, before the one full layout shared by every stage. The per-band-type parts live in reveal-handlers.ts. */
export function prepareReveal(d: DiagramData): number {
  const scopes = scopesOf(d.bands); // ADR 0012: ids / untils are keyed by the full name (`plan.p0`); a bare id is looked up through resolveAnchor
  const ctx: RevealCtx = {
    ids: new Map(), untils: new Map(), ownUntils: new Map(), replaced: new Set(), warnings: [], connects: [], max: 0,
    name: id => ctx.scope ? `${ctx.scope}.${id}` : id,
    set(x, inherited, where, inheritedUntil) {
      const own = checked(x.reveal, where) ?? 0;
      const n = Math.max(inherited, own);
      if (n) x.reveal = n;
      const u = earlier(inheritedUntil, checked(x.until, `${where} (until)`));
      if (u !== undefined) {
        if (u <= n) throw new Error(`${where}: until ${u} must be later than its reveal ${n || '(shown from the start)'}`);
        x.until = u;
        ctx.max = Math.max(ctx.max, u);
        if (x.id) ctx.untils.set(ctx.name(x.id), u);
      }
      ctx.max = Math.max(ctx.max, n);
      if (x.id) ctx.ids.set(ctx.name(x.id), n);
      return n;
    },
    walk(bands: Band[], inherited = 0, until?: number): void {
      for (const b of bands) atBand(b, () => {
        const h = revealHandlerFor(b);
        if (!h.stage) { h.visit?.(b as never, ctx); return; }
        const outer = ctx.scope;
        ctx.scope = undefined; // the band's own id is a name of the whole figure
        const n = ctx.set(b as Revealed, inherited, `${b.type}()`, until);
        const u = (b as Revealed).until;
        for (const id of nodeIdsOf(b)) { ctx.ids.set(id, n); if (u !== undefined) ctx.untils.set(id, u); } // the nodes of a self-placing figure come and go with it
        ctx.scope = scopeOf(b); // what the band holds (marks, bars, steps) is named under its scope
        h.visit?.(b as never, n, u, ctx);
        ctx.scope = outer;
      });
    },
  };
  const {ids, untils, warnings, connects} = ctx;
  ctx.walk(d.bands);
  let max = ctx.max;
  const known = (name: string): boolean => ids.has(name) || untils.has(name);
  const nameOf = (ref: string): string => resolveRevealId(scopes, ref, known);
  for (const c of connects) atBand(c, () => {
    const from = nameOf(c.from), to = nameOf(c.to);
    const ends = Math.max(ids.get(from) ?? 0, ids.get(to) ?? 0);
    const endpointUntil = earlier(untils.get(from), untils.get(to));
    warnConnectorReveal(warnings, c, {start: ends, end: endpointUntil});
    c.reveal ??= ends || undefined;
    max = Math.max(max, c.reveal ?? 0);
    // a connector goes with the first of its ends to vanish
    const gone = c.until ?? endpointUntil;
    if (gone !== undefined) {
      if (gone <= (c.reveal ?? 0)) throw new Error(`connect(${c.from} -> ${c.to}): until ${gone} must be later than its reveal ${c.reveal ?? '(shown from the start)'} (an arrow between two things that are never on screen together has nothing to show)`);
      c.until = gone;
      max = Math.max(max, gone);
    }
  });
  d.maxReveal = max;
  d.revealWarnings = warnings;
  return max;
}

export {visibleAt} from './reveal-visibility.ts';
