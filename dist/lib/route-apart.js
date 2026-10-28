// Long arrows that run side by side (ADR 0016 D14). Two arrows with different tails and different heads whose runs lie within 4px of each other
// read as one line: the layout puts the turns of the long arrows (and the runs through the layers) on shared lines, one per gap or layer.
// This moves one run of one arrow across, a few px at a time, and keeps a move only when that leaves the arrow beside fewer others and makes nothing worse
// (crossings, bends, a box pierced, leaving the figure, an arrow's neighbouring runs too short). Pure: placed routes in, placed routes out.
import { bendsOf, crossingsWith, runsTogether } from './polyline-metrics.js';
import { must } from './must.js';
/** A moved run keeps this clear of every box that is not an end of its arrow (the pierce test then counts a run that comes nearer). */
const CLEAR = 6;
/** The shortest run left on either side of a moved one (a 6px jog reads as a kink); next to a port and next to an arrowhead the stub / the head's room. */
const JOG = 10;
const STEPS = [8, -8, 16, -16, 24, -24];
/** Arrows from one tail or into one head merge on purpose (the ones into an AND are D11-D13's): only arrows with no end in common are counted as beside. An AND's arrow may move, but never next to another arrow (`near`). */
const related = (a, b) => a.from === b.from || a.to === b.to;
export function moveApart({ routes, edges, rects }) {
    const out = new Map(routes);
    const cache = new WeakMap(); // per call: the rendering core holds no module-level state
    const segs = (r) => {
        let s = cache.get(r);
        if (!s) {
            s = [];
            for (let k = 1; k < r.length; k++) {
                const p = r[k - 1], q = r[k];
                if (p && q)
                    s.push({ p, q });
            }
            cache.set(r, s);
        }
        return s;
    };
    const movable = (i) => { const e = edges.get(i); return e !== undefined && !e.self && !e.outer; };
    const beside = (i, r) => {
        const mine = segs(r), res = [], ei = edges.get(i);
        for (const [j, o] of out)
            if (ei && j !== i && movable(j) && !related(ei, must(edges.get(j))) && segs(o).some(y => mine.some(x => runsTogether(x, y))))
                res.push(j);
        return res;
    };
    /** How many other arrows (any: an outer return, a loop, one from the same tail or into the same head, an AND's) lie along this route. A move may not bring a new one beside it (swapping one for another does not count as fewer). */
    const near = (i, r) => {
        const mine = segs(r), n = new Set();
        for (const [j, o] of out)
            if (j !== i && segs(o).some(y => mine.some(x => runsTogether(x, y))))
                n.add(j);
        return n;
    };
    const pierces = (i, r) => {
        const e = must(edges.get(i));
        let n = 0;
        for (const [id, b] of rects)
            if (id !== e.from && id !== e.to && segs(r).some(({ p, q }) => Math.min(p.x, q.x) < b.x1 + CLEAR && Math.max(p.x, q.x) > b.x0 - CLEAR && Math.min(p.y, q.y) < b.y1 + CLEAR && Math.max(p.y, q.y) > b.y0 - CLEAR))
                n++;
        return n;
    };
    /** Does a run from `from` to `to` of `t` come nearer than CLEAR to a box that is not an end of the arrow, nearer than the same runs of `r` did (box by box)? */
    const crowds = (i, r, t, from, to) => {
        const e = must(edges.get(i));
        const gap = (route, b) => {
            let g = Infinity;
            for (let m = from; m <= to; m++) {
                const p = route[m], q = route[m + 1];
                if (!p || !q)
                    continue;
                g = Math.min(g, Math.hypot(Math.max(b.x0 - Math.max(p.x, q.x), Math.min(p.x, q.x) - b.x1, 0), Math.max(b.y0 - Math.max(p.y, q.y), Math.min(p.y, q.y) - b.y1, 0)));
            }
            return g;
        };
        for (const [id, b] of rects)
            if (id !== e.from && id !== e.to) {
                const after = gap(t, b);
                if (after < CLEAR && after < gap(r, b))
                    return true;
            }
        return false;
    };
    const all = [...routes.values()].flat();
    const lo = { x: Math.min(...all.map(p => p.x), ...[...rects.values()].map(b => b.x0)), y: Math.min(...all.map(p => p.y), ...[...rects.values()].map(b => b.y0)) };
    const hi = { x: Math.max(...all.map(p => p.x), ...[...rects.values()].map(b => b.x1)), y: Math.max(...all.map(p => p.y), ...[...rects.values()].map(b => b.y1)) };
    const inside = (r) => r.every(p => p.x >= lo.x && p.x <= hi.x && p.y >= lo.y && p.y <= hi.y);
    for (let round = 0; round < 3; round++) {
        let moved = false;
        for (const i of [...out.keys()]) {
            if (!movable(i))
                continue;
            const r = out.get(i);
            if (!r || r.length < 4)
                continue;
            const now = beside(i, r);
            if (!now.length)
                continue;
            const rest = [...out].filter(([j]) => j !== i).map(([, p]) => p), baseX = crossingsWith(r, rest), baseP = pierces(i, r), baseN = near(i, r);
            let done = false;
            // an inner run only: the first and the last stay on their ports; each is tried across, the smallest step first
            for (let k = 1; k + 2 < r.length && !done; k++) {
                const pk = must(r[k]), qk = must(r[k + 1]); // k + 2 < r.length
                const vertical = pk.x === qk.x;
                if (!vertical && pk.y !== qk.y)
                    continue;
                const s = { p: pk, q: qk };
                if (!now.some(j => segs(out.get(j) ?? []).some(y => runsTogether(s, y))))
                    continue;
                for (const d of STEPS) {
                    const t = r.map(p => ({ ...p }));
                    for (const m of [k, k + 1]) {
                        const tm = must(t[m]);
                        if (vertical)
                            tm.x += d;
                        else
                            tm.y += d;
                    }
                    // the runs on both sides keep their direction and a length that still shows a turn (the last one room for the arrowhead)
                    const c = vertical ? 'x' : 'y';
                    const keeps = (m, min) => { const r0 = must(r[m]), r1 = must(r[m + 1]), t0 = must(t[m]), t1 = must(t[m + 1]), before = r1[c] - r0[c], after = t1[c] - t0[c]; return before === 0 || (Math.sign(before) === Math.sign(after) && Math.abs(after) >= min); };
                    if (!keeps(k - 1, JOG) || !keeps(k + 1, k + 2 === r.length - 1 ? 22 : JOG))
                        continue;
                    if (!inside(t) || pierces(i, t) > baseP || bendsOf(t) > bendsOf(r) || [...near(i, t)].some(j => !baseN.has(j)) || crossingsWith(t, rest) > baseX)
                        continue;
                    // the moved run and its neighbours may not come nearer to a box than CLEAR unless they were that near before (counting the boxes alone lets a run onto the outline of a box another run already passes)
                    if (crowds(i, r, t, k - 1, k + 1))
                        continue;
                    if (beside(i, t).length >= now.length)
                        continue;
                    out.set(i, t);
                    done = moved = true;
                    break;
                }
            }
        }
        if (!moved)
            break;
    }
    return out;
}
