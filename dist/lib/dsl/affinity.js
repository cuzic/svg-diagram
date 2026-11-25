import { grid, row } from './containers.js';
import { box, group } from './text-bands.js';
/**
 * An affinity diagram (親和図): cards of ideas or facts gathered into groups, each group named by a short sentence (its 表札), and
 * larger groups made of smaller ones. Groups sit side by side (`cols`), cards stack inside a group (`cardCols` to put them in columns).
 *   affinity([{title: '準備が足りない', cards: ['段取りが決まっていない', '資料が古い']}, {title: '連絡が遅い', groups: [{title: '社内', cards: ['報告が遅れる']}]}])
 */
export function affinity(groups, opts = {}) {
    if (!Array.isArray(groups) || groups.length === 0)
        throw new Error('affinity(groups) needs at least one group');
    const cols = opts.cols ?? 3, cardCols = opts.cardCols ?? 1;
    for (const [k, v] of [['cols', cols], ['cardCols', cardCols]])
        if (!(Number.isInteger(v) && v >= 1 && v <= 6))
            throw new Error(`affinity(): ${k} must be a whole number from 1 to 6 (got ${v})`);
    const spanOf = (g, unit) => Math.min(unit, Math.max(1, g.groups?.length ?? 1));
    // a group made of smaller groups is as many columns wide as it has of them, so the small ones are not squeezed
    const build = (g, depth, span, unit) => {
        if (typeof g?.title !== 'string' || !g.title.trim())
            throw new Error('affinity(): every group needs a title (its 表札)');
        const cards = (g.cards ?? []).map(t => {
            if (typeof t !== 'string' || !t.trim())
                throw new Error(`affinity(): group "${g.title}" has an empty card`);
            return box({ body: t, tone: 'plain' });
        });
        if (!cards.length && !g.groups?.length)
            throw new Error(`affinity(): group "${g.title}" has no cards and no groups`);
        const inner = [...rows(g.groups ?? [], depth + 1, span), ...(cardCols > 1 && cards.length ? [grid(cards, { cols: cardCols })] : cards)];
        return group(inner, { title: g.title, tone: depth === 0 ? 'accent' : 'muted', dashed: false, ...(unit > 1 ? { span } : {}) });
    };
    // rows of `unit` columns, groups packed in order
    const rows = (list, depth, unit) => {
        const out = [];
        let cur = [], used = 0;
        const flush = () => { if (cur.length)
            out.push(row(cur, { cols: unit })); cur = []; used = 0; };
        for (const g of list) {
            const span = spanOf(g, unit);
            if (used + span > unit)
                flush();
            cur.push(build(g, depth, span, unit));
            used += span;
        }
        flush();
        return out;
    };
    return rows(groups, 0, cols);
}
