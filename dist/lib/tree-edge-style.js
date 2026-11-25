// ADR 0081: the look of the line from a parent to a child of a tree (TreeItem.edge). Pure helpers shared by the layout, the svg and the pptx.
import { PALETTE, colorOf, toneStyle } from './tokens.js';
export const DEFAULT_EDGE = { tone: 'muted', line: 'solid' };
export const sameEdge = (a, b) => a.tone === b.tone && a.line === b.line;
export const isDefaultEdge = (s) => sameEdge(s, DEFAULT_EDGE);
/** The written `edge` of an item with its defaults filled in (`undefined`, `{}` and `{tone: 'muted', line: 'solid'}` are the same). */
export const normalizeEdge = (item) => ({ tone: item.edge?.tone ?? 'muted', line: item.edge?.line ?? 'solid' });
/** Whether any item of the tree asks for a line that is not the default (then the private segment of each line is widened to 24px). */
export const hasStyledEdge = (items) => items.some(n => !isDefaultEdge(normalizeEdge(n)));
const sameStroke = (a, b) => a.color === b.color && a.line === b.line;
/**
 * The strokes of one line: `trunk` for the part its siblings share, `own` for the part that is the item's alone. A `focus` lit line is accent
 * (the trunk a solid accent so the way to the root stays whole), a dimmed tree (`spotlight`) is muted; both keep the item's line kind (ADR 0081 table).
 * The line is one path when the two are the same.
 */
export function edgeStrokes(e, dim, day, tones) {
    const s = e.style ?? DEFAULT_EDGE, t = e.trunk ?? s;
    const colorFor = (tone) => tone === 'muted' ? PALETTE.muted : colorOf(toneStyle(tones, tone).ink, day);
    if (dim)
        return { own: { color: PALETTE.muted, line: s.line }, trunk: { color: PALETTE.muted, line: 'solid' } };
    if (e.lit) {
        const accent = colorOf('accent', day);
        return { own: { color: accent, line: s.line }, trunk: { color: accent, line: 'solid' } };
    }
    return { own: { color: colorFor(s.tone), line: s.line }, trunk: { color: colorFor(t.tone), line: t.line } };
}
export const isOnePath = (own, trunk) => sameStroke(own, trunk);
/** Drawing order of the lines (svg and pptx): the default ones, then the styled ones, then the lit ones (a lit line is drawn over the trunk it shares). */
const rank = (e) => e.lit ? 2 : e.style ? 1 : 0;
export const compareEdgeOrder = (p, q) => rank(p) - rank(q);
/**
 * Decides `style` (S, the item's own last segment) and `trunk` (T, the part siblings share) of each line (ADR 0081 D2). A group is the lines of one parent
 * that leave from the same first point; a two-point line and a funnel (`from`) line share nothing and belong to no group.
 * `focused`: a line that is not lit is muted (its `edge.tone` is not used) with a solid trunk.
 */
export function assignEdgeStyles(edges, itemOf, focused) {
    const own = new Map();
    const groups = new Map();
    for (const e of edges) {
        const item = itemOf(e);
        if (!item)
            continue;
        let s = normalizeEdge(item);
        if (focused && !e.lit)
            s = { tone: 'muted', line: s.line };
        own.set(e, s);
        const p = e.points[0];
        if (e.points.length <= 2 || item.from !== undefined || !p || e.from === undefined)
            continue;
        const key = `${e.from}|${p.x}|${p.y}`;
        groups.set(key, [...groups.get(key) ?? [], e]);
    }
    const trunkOf = new Map();
    for (const g of groups.values()) {
        const first = own.get(g[0]);
        const same = g.every(e => sameEdge(own.get(e), first));
        for (const e of g)
            trunkOf.set(e, focused && !e.lit ? DEFAULT_EDGE : same ? first : DEFAULT_EDGE);
    }
    for (const [e, s] of own) {
        const t = trunkOf.get(e) ?? s;
        if (!isDefaultEdge(s))
            e.style = s;
        if (!sameEdge(t, s))
            e.trunk = t;
    }
}
