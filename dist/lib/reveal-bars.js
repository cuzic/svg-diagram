import { checked } from './reveal-visibility.js';
// bars: each value is an element; `replaces` ends an earlier bar at the very click its replacement comes.
export function revealBars(b, n, u, ctx) {
    for (const [i, bar] of b.data.entries()) {
        ctx.ownUntils.set(bar, bar.until); // the bar's own, before set() merges in the band's
        if (bar.replaces !== undefined) {
            if (b.stack)
                throw new Error(`bars() value ${i + 1}: replaces does not work with stack (the segments share one bar)`);
            const old = b.data.slice(0, i).find(d => d.id === bar.replaces);
            if (!old)
                throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}" must name the id of an earlier bar of the same band`);
            if (bar.reveal === undefined)
                throw new Error(`bars() value ${i + 1}: a bar that replaces another needs a reveal (the click it takes the place at)`);
            if (ctx.replaced.has(ctx.name(bar.replaces)))
                throw new Error(`bars() value ${i + 1}: "${bar.replaces}" is already replaced by another bar`);
            ctx.replaced.add(ctx.name(bar.replaces));
            const oldOwn = ctx.ownUntils.get(old);
            if (oldOwn !== undefined && oldOwn !== bar.reveal)
                throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}", which already vanishes at ${oldOwn}, not at this bar's reveal ${bar.reveal}`);
            if (bar.reveal <= (old.reveal ?? 0))
                throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}" but is revealed (${bar.reveal}) no later than it (${old.reveal ?? 0})`);
            if (old.id)
                ctx.untils.set(ctx.name(old.id), bar.reveal);
            old.until = bar.reveal; // the replaced bar goes at the very click its replacement comes
        }
        const r = ctx.set(bar, n, `bars() value ${i + 1}`, u);
        if (bar.id)
            ctx.ids.set(ctx.name(bar.id), r);
    }
}
export function revealBarElements(data, start, end) {
    let last = start;
    revealBars(data, start, end, {
        ownUntils: new Map(), replaced: new Set(), untils: new Map(), ids: new Map(), name: id => id,
        set(bar, inherited, where, inheritedUntil) {
            const reveal = Math.max(inherited, checked(bar.reveal, where) ?? 0);
            const until = Math.min(inheritedUntil ?? Infinity, checked(bar.until, `${where} (until)`) ?? Infinity);
            if (until <= reveal)
                throw new Error(`${where}: until ${until} must be later than its reveal ${reveal || '(shown from the start)'}`);
            if (reveal)
                bar.reveal = reveal;
            if (Number.isFinite(until))
                bar.until = until;
            last = Math.max(last, bar.until ?? reveal);
            return reveal;
        },
    });
    return { last, warnings: [], items: data.data };
}
