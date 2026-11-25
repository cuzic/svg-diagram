// Bends, crossings and length of polylines: pure functions of points (ADR 0016 D6). The layered layout's candidate score
// (layered-route.ts) and the `edge-bends` / `edge-crossings` checks (rules.ts) count with these, so a drawing layer never reads a check.
const same = (a, b) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
/** Drops repeated points and the middle point of three on a line, so a polyline has only its corners. */
export function simplify(pts) {
    const out = [];
    for (const p of pts) {
        const last = out[out.length - 1];
        if (!last || !same(last, p))
            out.push(p);
    }
    const n = out.length;
    if (n < 3)
        return out;
    // the middle point of three on a line goes, the three being neighbours in the list without repeats (a point that goes does not change which are the neighbours of the next)
    const res = [out[0]];
    for (let i = 1; i < n - 1; i++) {
        const a = out[i - 1], p = out[i], b = out[i + 1];
        if (!((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y)))
            res.push(p);
    }
    res.push(out[n - 1]);
    return res;
}
/** The bends of a polyline: the inner points where the line turns (a repeated point or a point in the middle of a straight run is not one). */
export const bendsOf = (points) => Math.max(0, simplify(points).length - 2);
/** The length of a polyline. */
export function totalLength(points) {
    let n = 0;
    for (let i = 1; i < points.length; i++) {
        const a = points[i], b = points[i - 1];
        if (a && b)
            n += Math.hypot(a.x - b.x, a.y - b.y);
    }
    return n;
}
/**
 * The places where two different polylines properly cross at a right angle: a horizontal run against a vertical one. Touching and
 * overlapping do not count, nor does a polyline crossing itself. Diagonal segments are not counted.
 */
export function crossingsOf(paths, o = {}) {
    const m = o.margin ?? 0, tol = o.tol ?? 0;
    const level = (a, b) => a.y === b.y || Math.abs(a.y - b.y) < tol;
    const plumb = (a, b) => a.x === b.x || Math.abs(a.x - b.x) < tol;
    const hs = [], vs = [];
    for (const p of paths) {
        const h = [], v = [];
        for (let i = 1; i < p.length; i++) {
            const a = p[i - 1], b = p[i];
            if (!a || !b)
                continue;
            if (level(a, b))
                h.push({ y: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
            if (plumb(a, b))
                v.push({ x: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
        }
        hs.push(h);
        vs.push(v);
    }
    let n = 0;
    for (let i = 0; i < paths.length; i++)
        for (let j = i + 1; j < paths.length; j++) {
            for (const [h, v] of [[hs[i] ?? [], vs[j] ?? []], [hs[j] ?? [], vs[i] ?? []]])
                for (const a of h)
                    for (const b of v) {
                        if (b.x > a.lo + m && b.x < a.hi - m && a.y > b.lo + m && a.y < b.hi - m)
                            n++;
                    }
        }
    return n;
}
export function runsOfPath(p, o = {}) {
    const tol = o.tol ?? 0;
    const h = [], v = [];
    for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], b = p[i];
        if (!a || !b)
            continue;
        if (a.y === b.y || Math.abs(a.y - b.y) < tol)
            h.push({ at: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
        if (a.x === b.x || Math.abs(a.x - b.x) < tol)
            v.push({ at: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
    }
    return { h, v };
}
/** The crossings of two polylines from their runs (what `crossingsWith(a, [b])` counts). */
export function crossingsOfRuns(a, b, o = {}) {
    const m = o.margin ?? 0;
    const cross = (h, v) => { let n = 0; for (const x of h)
        for (const y of v)
            if (y.at > x.lo + m && y.at < x.hi - m && x.at > y.lo + m && x.at < y.hi - m)
                n++; return n; };
    return cross(a.h, b.v) + cross(b.h, a.v);
}
/** The crossings of one polyline with each of the others (the same count as `crossingsOf`, for a figure in which only this one changed). Only its own pairs are compared: the others are not counted against each other. */
export function crossingsWith(path, others, o = {}, cache) {
    const useCache = cache !== undefined && o.tol === undefined && o.margin === undefined; // the cache holds the runs for the default options only
    const runsIn = (r) => { let x = useCache ? cache?.get(r) : undefined; if (!x) {
        x = runsOfPath(r, o);
        if (useCache)
            cache?.set(r, x);
    } return x; }; // `cache`: the runs of a route by its array, the caller's (the others are the same routes try after try)
    const mine = runsIn(path);
    let n = 0;
    for (const other of others)
        n += crossingsOfRuns(mine, runsIn(other), o);
    return n;
}
const samePath = (a, b) => {
    if (a === b)
        return true;
    if (a.length !== b.length)
        return false;
    for (let k = 0; k < a.length; k++) {
        const p = a[k], q = b[k];
        if (p.x !== q.x || p.y !== q.y)
            return false;
    }
    return true;
};
/**
 * `scoreOf(next)`, from the score of `prev` and the routes that differ: a local search tries one change after another, and a change moves a few
 * routes, so counting every pair of routes again for each try is most of its cost. The same numbers as counting afresh (test/polyline-metrics.test.ts).
 */
export function rescore(prev, prevScore, next, cache) {
    if (prev.size !== next.size)
        return scoreOf([...next.values()]);
    for (const k of next.keys())
        if (!prev.has(k))
            return scoreOf([...next.values()]);
    const before = [], after = [], rest = [];
    for (const [k, r] of next) {
        const old = prev.get(k);
        if (samePath(old, r))
            rest.push(old);
        else {
            before.push(old);
            after.push(r);
        }
    }
    if (!after.length)
        return prevScore;
    const against = (moved) => crossingsOf(moved) + moved.reduce((n, r) => n + crossingsWith(r, rest, {}, cache), 0);
    return {
        crossings: prevScore.crossings - against(before) + against(after),
        bends: prevScore.bends - before.reduce((n, r) => n + bendsOf(r), 0) + after.reduce((n, r) => n + bendsOf(r), 0),
    };
}
/** The candidate score of routed arrows: crossings and bends (lower is better; compared crossings first). */
export const scoreOf = (paths) => ({ crossings: crossingsOf(paths), bends: paths.reduce((n, p) => n + bendsOf(p), 0) });
/** Two runs of arrows side by side (under 4px apart, over 4px long together): they read as one line. Shared by the verifier (`cause-parallel`) and the router (ADR 0016 D11). */
export function runsTogether(a, b) {
    const aH = a.p.y === a.q.y;
    if (aH !== (b.p.y === b.q.y))
        return false;
    const [c, d] = aH ? ['x', 'y'] : ['y', 'x'];
    return Math.abs(a.p[d] - b.p[d]) < 4 && Math.min(Math.max(a.p[c], a.q[c]), Math.max(b.p[c], b.q[c])) - Math.max(Math.min(a.p[c], a.q[c]), Math.min(b.p[c], b.q[c])) > 4;
}
/**
 * The runs of two different routes on one axis (level with level, plumb with plumb; either direction) that are under `sep` apart and
 * over 4px long together (ADR 0070 D2). Routes that share an end count too. Each route's corners are taken first (`simplify`), so a
 * straight run is one run however many points it has; a slanted segment is not a run. `runsTogether` is the case `sep = 4` for two
 * single runs, and keeps its own definition (the verifier's `cause-parallel` and the router's ADR 0016 D11 read it).
 */
export function parallelRuns(routes, sep) {
    const runs = routes.map(r => runsOfRoute(r)), out = [];
    for (let i = 0; i < runs.length; i++)
        for (let j = i + 1; j < runs.length; j++) {
            for (const r of runs[i] ?? [])
                for (const s of runs[j] ?? []) {
                    if (r.level !== s.level)
                        continue;
                    const gap = Math.abs(r.at - s.at), overlap = Math.min(r.hi, s.hi) - Math.max(r.lo, s.lo);
                    if (gap < sep && overlap > 4)
                        out.push({ a: i, b: j, gap, overlap });
                }
        }
    return out;
}
/** A route's runs, its corners first (`simplify`): a straight run is one however many points it has; a point and a slanted segment are not runs. */
export function runsOfRoute(pts) {
    const s = simplify(pts), out = [];
    for (let i = 1; i < s.length; i++) {
        const p = s[i - 1], q = s[i];
        const level = Math.abs(p.y - q.y) < 0.5, plumb = Math.abs(p.x - q.x) < 0.5;
        if (level === plumb)
            continue;
        out.push(level ? { level, at: p.y, lo: Math.min(p.x, q.x), hi: Math.max(p.x, q.x) } : { level, at: p.x, lo: Math.min(p.y, q.y), hi: Math.max(p.y, q.y) });
    }
    return out;
}
/**
 * The ways two routes lie against each other (ADR 0070 U4c): how many pairs of runs, one of each, both level (`level`) or both plumb (`plumb`), are side by
 * side (on one axis under `sep` apart, over 4px long together: `parallelRuns`' pair) or on one line with their ends under `sep` apart (a pair `parallelRuns`
 * leaves out: two runs that read as one, ADR 0070 U4b's `touch`).
 */
export function runPairWays(a, b, sep) {
    let level = 0, plumb = 0;
    for (const r of a)
        for (const s of b) {
            if (r.level !== s.level)
                continue;
            const gap = Math.abs(r.at - s.at), overlap = Math.min(r.hi, s.hi) - Math.max(r.lo, s.lo);
            if (overlap > 4 ? gap < sep : gap < 0.5 && overlap > -sep) {
                if (r.level)
                    level++;
                else
                    plumb++;
            }
        }
    return { level, plumb };
}
/** The run pairs of a figure (ADR 0073 D2): `runPairWays` summed over every two routes, at one `sep` (the lane step of the figure), and the overlaps under 4px once more (`parallelRuns(routes, 4)`). `pairs >= parallelRuns(routes, sep).length`: it also counts the pairs on one line. */
export function pairsOf(routes, sep) {
    const runs = routes.map(r => runsOfRoute(r));
    let n = 0;
    for (const [i, a] of runs.entries())
        for (const b of runs.slice(i + 1)) {
            const w = runPairWays(a, b, sep);
            n += w.level + w.plumb;
        }
    return n + parallelRuns(routes, 4).length; // a pair on one line (under 4px) is worse to read than one side by side: it counts twice (ADR 0070 U4c: never create an overlap)
}
/** The box of a route, worked out once per array in `cache` (the caller's, so no module holds state); its runs are worked out when they are first asked for (`runsIn`). */
export function routedRuns(r, cache) {
    let e = cache.get(r);
    if (!e) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of r) {
            x0 = Math.min(x0, p.x);
            x1 = Math.max(x1, p.x);
            y0 = Math.min(y0, p.y);
            y1 = Math.max(y1, p.y);
        }
        e = { pts: r, x0, x1, y0, y1 };
        cache.set(r, e);
    }
    return e;
}
/**
 * How many pairs `next` has against the other routes that `prev` did not (`runPairWays`): the most of the new kinds of pair and the growth of the moved routes' pairs in all (0 or less: none). Only the routes that differ are asked: for each, the other routes
 * it lies against. It does when it lies against a route level or plumb where it did not (the same two routes the other way, a plumb pair for a level
 * one, is a gain too), or when the pairs of the moved routes are more in all than they were. A pair that was there stays allowed (it may be a bit
 * nearer). `cache` holds the runs of the routes by their arrays.
 */
export function runPairGain(prev, next, sep, cache) {
    const near = (a, b) => a.x0 - sep - 1 <= b.x1 && b.x0 - sep - 1 <= a.x1 && a.y0 - sep - 1 <= b.y1 && b.y0 - sep - 1 <= a.y1;
    let before = 0, after = 0, newWays = 0;
    for (const [k, r] of next) {
        const old = prev.get(k);
        if (!old || samePath(old, r))
            continue;
        const was0 = routedRuns(old, cache), now0 = routedRuns(r, cache);
        for (const [o, ro] of next) {
            if (o === k)
                continue;
            const oldO = prev.get(o) ?? ro, other = routedRuns(samePath(oldO, ro) ? oldO : ro, cache), otherWas = routedRuns(oldO, cache); // an unchanged route's runs are those of its old array
            const was = near(was0, otherWas) ? runPairWays(runsIn(was0), runsIn(otherWas), sep) : NONE, now = near(now0, other) ? runPairWays(runsIn(now0), runsIn(other), sep) : NONE;
            if ((now.level > 0 && was.level === 0) || (now.plumb > 0 && was.plumb === 0))
                newWays++;
            before += was.level + was.plumb;
            after += now.level + now.plumb;
        }
    }
    return Math.max(after - before, newWays);
}
/** Does `next` lie against the other routes in a way `prev` did not (`runPairGain` over 0)? */
export function gainsRunPairs(prev, next, sep, cache) {
    return runPairGain(prev, next, sep, cache) > 0;
}
const runsIn = (e) => e.runs ??= runsOfRoute(e.pts);
const NONE = { level: 0, plumb: 0 };
