import { resolveAnchor, scopeOf, scopesOf } from './anchor-scope.js';
import { nodeIdsOf } from './band-ids.js';
import { checked, earlier, revealHandlerFor } from './reveal-handlers.js';
const refId = (ref) => ref.split(':')[0] ?? ref;
/** Resolve inheritance once, before the one full layout shared by every stage. The per-band-type parts live in reveal-handlers.ts. */
export function prepareReveal(d) {
    const scopes = scopesOf(d.bands); // ADR 0012: ids / untils are keyed by the full name (`plan.p0`); a bare id is looked up through resolveAnchor
    const ctx = {
        ids: new Map(), untils: new Map(), ownUntils: new Map(), replaced: new Set(), warnings: [], connects: [], max: 0,
        name: id => ctx.scope ? `${ctx.scope}.${id}` : id,
        set(x, inherited, where, inheritedUntil) {
            const own = checked(x.reveal, where) ?? 0;
            const n = Math.max(inherited, own);
            if (n)
                x.reveal = n;
            const u = earlier(inheritedUntil, checked(x.until, `${where} (until)`));
            if (u !== undefined) {
                if (u <= n)
                    throw new Error(`${where}: until ${u} must be later than its reveal ${n || '(shown from the start)'}`);
                x.until = u;
                ctx.max = Math.max(ctx.max, u);
                if (x.id)
                    ctx.untils.set(ctx.name(x.id), u);
            }
            ctx.max = Math.max(ctx.max, n);
            if (x.id)
                ctx.ids.set(ctx.name(x.id), n);
            return n;
        },
        walk(bands, inherited = 0, until) {
            for (const b of bands) {
                const h = revealHandlerFor(b);
                if (!h.stage) {
                    h.visit?.(b, ctx);
                    continue;
                }
                const outer = ctx.scope;
                ctx.scope = undefined; // the band's own id is a name of the whole figure
                const n = ctx.set(b, inherited, `${b.type}()`, until);
                const u = b.until;
                for (const id of nodeIdsOf(b)) {
                    ctx.ids.set(id, n);
                    if (u !== undefined)
                        ctx.untils.set(id, u);
                } // the nodes of a self-placing figure come and go with it
                ctx.scope = scopeOf(b); // what the band holds (marks, bars, steps) is named under its scope
                h.visit?.(b, n, u, ctx);
                ctx.scope = outer;
            }
        },
    };
    const { ids, untils, warnings, connects } = ctx;
    ctx.walk(d.bands);
    let max = ctx.max;
    const known = (name) => ids.has(name) || untils.has(name);
    const nameOf = (ref) => resolveAnchor(scopes, refId(ref), known) ?? refId(ref); // throws when a bare id names several scoped items
    for (const c of connects) {
        const from = nameOf(c.from), to = nameOf(c.to);
        const ends = Math.max(ids.get(from) ?? 0, ids.get(to) ?? 0);
        const explicit = c.reveal;
        if (explicit !== undefined && explicit < ends)
            warnings.push(`connect(${c.from} -> ${c.to}) reveal ${explicit} is earlier than an endpoint (reveal ${ends})`);
        c.reveal = explicit ?? (ends || undefined);
        max = Math.max(max, c.reveal ?? 0);
        // a connector goes with the first of its ends to vanish
        const gone = c.until ?? earlier(untils.get(from), untils.get(to));
        if (gone !== undefined) {
            const ends2 = earlier(untils.get(from), untils.get(to));
            if (c.until !== undefined && ends2 !== undefined && c.until > ends2)
                warnings.push(`connect(${c.from} -> ${c.to}) until ${c.until} is later than an endpoint's (vanishes at ${ends2})`);
            if (gone <= (c.reveal ?? 0))
                throw new Error(`connect(${c.from} -> ${c.to}): until ${gone} must be later than its reveal ${c.reveal ?? '(shown from the start)'} (an arrow between two things that are never on screen together has nothing to show)`);
            c.until = gone;
            max = Math.max(max, gone);
        }
    }
    d.maxReveal = max;
    d.revealWarnings = warnings;
    return max;
}
export const visibleAt = (x, stage) => stage === undefined || ((x.reveal ?? 0) <= stage && (x.until === undefined || stage < x.until));
