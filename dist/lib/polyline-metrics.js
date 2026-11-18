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
    return out.filter((p, i) => {
        if (i === 0 || i === out.length - 1)
            return true;
        const a = out[i - 1], b = out[i + 1];
        if (!a || !b)
            return true;
        return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
    });
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
/** The crossings of one polyline with each of the others (the same count as `crossingsOf`, for a figure in which only this one changed). Only its own pairs are compared: the others are not counted against each other. */
export function crossingsWith(path, others, o = {}) {
    const m = o.margin ?? 0, tol = o.tol ?? 0;
    const runsOf = (p) => {
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
    };
    const cross = (h, v) => { let n = 0; for (const a of h)
        for (const b of v)
            if (b.at > a.lo + m && b.at < a.hi - m && a.at > b.lo + m && a.at < b.hi - m)
                n++; return n; };
    const mine = runsOf(path);
    let n = 0;
    for (const other of others) {
        const r = runsOf(other);
        n += cross(mine.h, r.v) + cross(r.h, mine.v);
    }
    return n;
}
const samePath = (a, b) => a === b || (a.length === b.length && a.every((p, k) => { const q = b[k]; return p.x === q.x && p.y === q.y; }));
/**
 * `scoreOf(next)`, from the score of `prev` and the routes that differ: a local search tries one change after another, and a change moves a few
 * routes, so counting every pair of routes again for each try is most of its cost. The same numbers as counting afresh (test/polyline-metrics.test.ts).
 */
export function rescore(prev, prevScore, next) {
    if (prev.size !== next.size || [...next.keys()].some(k => !prev.has(k)))
        return scoreOf([...next.values()]);
    const before = [], after = [], rest = [];
    for (const [k, r] of next) {
        const old = prev.get(k);
        if (samePath(old, r))
            rest.push(r);
        else {
            before.push(old);
            after.push(r);
        }
    }
    if (!after.length)
        return prevScore;
    const against = (moved) => crossingsOf(moved) + moved.reduce((n, r) => n + crossingsWith(r, rest), 0);
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
