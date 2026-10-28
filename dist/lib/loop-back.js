// `loopBack` on a row of steps / a horizontal chevron (ADR 0029 D4): the arrow that goes back to an earlier step, drawn under the boxes.
// Written as options of the band; a pre-layout pass turns each into an ordinary connect() with route 'loop-under' right after the band, with the
// lanes stepped so that no two loops cross or run at one height (hand-written loop-under connects keep the `dip` the author wrote).
import { connectBand } from './dsl/defaults.js';
import { must } from './must.js';
const LINES = ['solid', 'dashed', 'dotted'];
/** The height of the first loop under the boxes, and how much each loop outside it adds (px). */
const DIP = 32, LANE = 28;
/**
 * Checks what the author wrote for a band of `n` steps and returns it with every end as a 1-based number. `ids` are the item ids of a chevron, which may
 * also be given instead of a number. Two loops must nest (one span inside the other) or touch at most at an end: partly overlapping spans cross.
 */
export function resolveLoopBacks(who, raw, n, ids) {
    const list = Array.isArray(raw) ? raw : [raw];
    if (!list.length)
        throw new Error(`${who}: loopBack is empty (write {from, to} or leave it out)`);
    const end = (v, name) => {
        if (typeof v === 'string' && ids) {
            const i = ids.indexOf(v);
            if (i < 0)
                throw new Error(`${who}: loopBack.${name} "${v}" is not an item id of this chevron (${ids.filter(Boolean).join(', ') || 'no item has an id'})`);
            return i + 1;
        }
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > n)
            throw new Error(`${who}: loopBack.${name} ${JSON.stringify(v)} is not a step (1..${n}${ids ? ', or an item id' : ''})`);
        return v;
    };
    const out = list.map(l => {
        if (typeof l !== 'object' || l === null)
            throw new Error(`${who}: loopBack takes {from, to, label?} (got ${JSON.stringify(l)})`);
        const from = end(l.from, 'from'), to = end(l.to, 'to');
        if (from <= to)
            throw new Error(`${who}: loopBack from ${from} must come after to ${to}: a loop goes back (from > to)`);
        if (l.label !== undefined && (typeof l.label !== 'string' || !l.label.trim() || /[\r\n]/.test(l.label)))
            throw new Error(`${who}: loopBack.label is a non-empty one-line text (got ${JSON.stringify(l.label)})`);
        if (l.line !== undefined && !LINES.includes(l.line))
            throw new Error(`${who}: loopBack.line must be solid, dashed or dotted (got ${String(l.line)})`);
        return { ...l, from, to };
    });
    for (const [i, a] of out.entries())
        for (const b of out.slice(i + 1)) {
            const [al, ah, bl, bh] = [a.to, a.from, b.to, b.from];
            if ((al < bl && bl < ah && ah < bh) || (bl < al && al < bh && bh < ah))
                throw new Error(`${who}: loopBack ${ah}→${al} and ${bh}→${bl} cross each other; nest them (one span inside the other) or drop one`);
        }
    return out;
}
/** The loops of every band that has `loopBack`, as connect() bands placed right after it (in a group too). A band without an id gets an internal one to anchor on. */
export function expandLoopBacks(bands) {
    let internal = 0;
    const visit = (list) => list.flatMap(b => {
        if (b.type === 'group')
            b.children = visit(b.children);
        if ((b.type !== 'row' && b.type !== 'chevron') || !b.loopBack)
            return [b];
        const loops = (Array.isArray(b.loopBack) ? b.loopBack : [b.loopBack]);
        const id = b.id ?? (b.id = `__loopback${internal++}`);
        const anchor = (i) => {
            if (b.type === 'row')
                return `${id}#${i}`;
            const step = must(b.steps[i - 1]); // resolveLoopBacks checked 1..n
            return step.id ?? (step.id = `${id}__${i}`);
        };
        // the shorter the span, the nearer the boxes: loops inside another one sit above it, so no vertical leg crosses another loop's run
        const byLane = [...loops].sort((x, y) => (x.from - x.to) - (y.from - y.to));
        const connects = byLane.map((l, lane) => Object.assign(connectBand(`${anchor(l.from)}:bottom`, `${anchor(l.to)}:bottom`, {
            route: 'loop-under', dip: DIP + lane * LANE, ...(l.label === undefined ? {} : { label: l.label }), ...(l.chip === undefined ? {} : { chip: l.chip }), ...(l.tone === undefined ? {} : { tone: l.tone }), ...(l.line === undefined ? {} : { line: l.line }),
        }, false), { loopBack: true }));
        return [b, ...connects];
    });
    return visit(bands);
}
