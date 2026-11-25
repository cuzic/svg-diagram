export const FOCUSED = 'solid', RELATED = 'accent', OTHER = 'muted';
/**
 * The indices of the focused items. `ids[i]` is the id of item i (undefined: it has none). Numbers (1-based positions) are taken
 * only when `numbers` is true (a sequence); anything that names no item throws, listing what can be named.
 */
export function resolveFocus(focus, ids, who, numbers = false) {
    const refs = Array.isArray(focus) ? focus : [focus];
    const what = numbers ? `the id of an item or its number 1..${ids.length}` : 'the id of an item';
    if (!refs.length)
        throw new Error(`${who}: focus is ${what}, or a list of them (got an empty list)`);
    const known = ids.filter((id) => typeof id === 'string');
    const out = new Set();
    for (const r of refs) {
        if (typeof r === 'number') {
            if (!numbers)
                throw new Error(`${who}: focus is ${what} (got ${r}: this figure names its items by id)`);
            if (!Number.isInteger(r) || r < 1 || r > ids.length)
                throw new Error(`${who}: focus ${r} is not an item number 1..${ids.length}`);
            out.add(r - 1);
        }
        else if (typeof r === 'string' && r) {
            const i = ids.indexOf(r);
            if (i < 0)
                throw new Error(`${who}: focus "${r}" is not the id of an item${known.length ? ` (the ids: ${known.join(', ')})` : numbers ? ` (no item has an id: give it one, or use its number 1..${ids.length})` : ' (no item has an id)'}`);
            out.add(i);
        }
        else
            throw new Error(`${who}: focus is ${what}, or a list of them (got ${JSON.stringify(r)})`);
    }
    return out;
}
/** A graph: the focused items solid, the ones a link away accent, the rest muted. `links` are pairs of item indices (either direction). */
export function graphTones(n, links, focused) {
    const near = new Set();
    for (const [a, b] of links) {
        if (focused.has(a))
            near.add(b);
        if (focused.has(b))
            near.add(a);
    }
    return Array.from({ length: n }, (_, i) => focused.has(i) ? FOCUSED : near.has(i) ? RELATED : OTHER);
}
/** A sequence: the focused items solid, the rest muted. */
export function sequenceTones(n, focused) {
    return Array.from({ length: n }, (_, i) => focused.has(i) ? FOCUSED : OTHER);
}
/** A link of a graph is lit when it touches a focused item. */
export const litLink = (a, b, focused) => focused.has(a) || focused.has(b);
