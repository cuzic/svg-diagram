// ADR 0075 D1: the search for the order of the rows of a layered layout (the dummies of the long arrows included), run once per figure by causeTree.
// What it minimises: the pairs of links between two neighbouring layers that cross. A pair of links that both run into one AND effect (or both run out of it) weighs
// AND_WEIGHT: an AND crossing is the first key of the figure's score. A move is a swap of two neighbours in a row, inside one connected component. Every number below is fixed by the ADR.
import { must } from './must.js';
const RESTARTS = 5, MOVES = 3000, T0 = 2, T_END = 0.05, SEED = 7, AND_WEIGHT = 6, SIFT_PASSES = 8;
/** An element of an array the loops index inside its bounds (no `!`: lint forbids it; the numbers are the same). */
const at = (a, i) => a[i];
const isDummy = (id) => id.startsWith('\u0000');
/** The crossings between neighbouring layers of `rows`: weighted (AND links count AND_WEIGHT) or plain. Used by the tests to check the cost the search tracked move by move. */
export function layerCrossings(rows, succ, andTo, plain) {
    const g = graph(rows, succ, andTo, () => 0);
    return g.total(plain);
}
function graph(rows, succ, andTo, comp) {
    const ids = [], idx = new Map();
    for (const r of rows)
        for (const id of r) {
            idx.set(id, ids.length);
            ids.push(id);
        }
    const N = ids.length, up = Array.from({ length: N }, () => []), down = Array.from({ length: N }, () => []);
    for (const [a, bs] of succ)
        for (const b of bs) {
            const x = idx.get(a), y = idx.get(b);
            if (x === undefined || y === undefined)
                continue;
            at(down, x).push(y);
            at(up, y).push(x);
        }
    const cmp = ids.map(comp), real = ids.map(id => !isDummy(id)), isAnd = ids.map(id => andTo.has(id));
    const upEnd = new Int32Array(N).fill(-1), downEnd = new Int32Array(N).fill(-1); // the real node a chain of dummies reaches going up / down
    const endUp = (n) => at(real, n) ? n : at(upEnd, n) >= 0 ? at(upEnd, n) : (upEnd[n] = at(up, n).length ? endUp(at(at(up, n), 0)) : n);
    const endDown = (n) => at(real, n) ? n : at(downEnd, n) >= 0 ? at(downEnd, n) : (downEnd[n] = at(down, n).length ? endDown(at(at(down, n), 0)) : n);
    // two links x1 -> y1 and x2 -> y2 weigh AND_WEIGHT when their lower ends are one AND effect, or their upper ends are (the links that leave it)
    const wt = (x1, y1, x2, y2) => {
        const r1 = endDown(y1), l1 = endUp(x1);
        return (at(isAnd, r1) && r1 === endDown(y2)) || (at(isAnd, l1) && l1 === endUp(x2)) ? AND_WEIGHT : 1;
    };
    const R = rows.map(r => r.map(id => must(idx.get(id)))), pos = new Int32Array(N);
    const reset = (src) => { src.forEach((r, l) => { R[l] = r.slice(); at(R, l).forEach((n, i) => { pos[n] = i; }); }); };
    reset(R.map(r => r.slice()));
    const total = (plain) => {
        let c = 0;
        for (let l = 0; l + 1 < R.length; l++) {
            const ls = [];
            for (const u of at(R, l))
                for (const v of at(down, u))
                    ls.push([at(pos, u), at(pos, v), u, v]);
            for (let i = 0; i < ls.length; i++)
                for (let j = i + 1; j < ls.length; j++)
                    if ((at(at(ls, i), 0) - at(at(ls, j), 0)) * (at(at(ls, i), 1) - at(at(ls, j), 1)) < 0)
                        c += plain ? 1 : wt(at(at(ls, i), 2), at(at(ls, i), 3), at(at(ls, j), 2), at(at(ls, j), 3));
        }
        return c;
    };
    return { ids, up, down, cmp, R, pos, reset, total, wt };
}
/**
 * ADR 0075 D1. `rows` are the rows the sweeps left; `succ` the links (from the lower layer to the next one); `comp` the connected component of a node (a swap never crosses one); `andTo` the AND effects.
 * Deterministic: one linear congruential stream (seed 7) is shared by every restart and row.
 */
export function searchLayerRows(rows, succ, comp, andTo) {
    const g = graph(rows, succ, andTo, comp), { ids, up, down, cmp, R, pos, reset, total, wt } = g;
    // the change of the weighted crossings when a (at p) and b (at p + 1) swap: the pairs of links into a and into b from each neighbouring layer
    const delta = (a, b) => {
        let d = 0;
        for (const [A, B] of [[at(up, a), at(up, b)], [at(down, a), at(down, b)]])
            for (const u of A) {
                const pu = at(pos, u);
                for (const w of B) {
                    const pw = at(pos, w);
                    if (pu < pw)
                        d += wt(u, a, w, b);
                    else if (pu > pw)
                        d -= wt(u, a, w, b);
                }
            }
        return d;
    };
    const swap = (l, p) => { const r = at(R, l), a = at(r, p), b = at(r, p + 1); r[p] = b; r[p + 1] = a; pos[b] = p; pos[a] = p + 1; };
    const seedRows = R.map(r => r.slice());
    const c0 = total(false);
    let s = SEED, cur = c0, best = c0, bestRows = R.map(r => r.slice()), nMoves = 0;
    const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    const note = () => { if (cur < best) {
        best = cur;
        bestRows = R.map(r => r.slice());
    } };
    // sifting: each node (the most linked first) goes to the position in its row, inside its component, with the fewest crossings; it moves only for a strictly lower value, a tie goes to the nearer position (the right side first)
    const sift = () => {
        for (let pass = 0; pass < SIFT_PASSES; pass++) {
            const before = cur;
            for (let l = 0; l < R.length; l++) {
                const r = at(R, l);
                if (r.length < 2)
                    continue;
                for (const n of r.slice().sort((x, y) => (at(up, y).length + at(down, y).length) - (at(up, x).length + at(down, x).length))) {
                    const home = at(pos, n);
                    let bestP = home, bestD = 0, acc = 0, p = home;
                    while (p + 1 < r.length && cmp[at(r, p + 1)] === cmp[n]) {
                        acc += delta(n, at(r, p + 1));
                        swap(l, p);
                        p++;
                        if (acc < bestD || (acc === bestD && Math.abs(p - home) < Math.abs(bestP - home))) {
                            bestD = acc;
                            bestP = p;
                        }
                    }
                    while (p > home) {
                        p--;
                        swap(l, p);
                    }
                    acc = 0;
                    p = home;
                    while (p > 0 && cmp[at(r, p - 1)] === cmp[n]) {
                        acc += delta(at(r, p - 1), n);
                        swap(l, p - 1);
                        p--;
                        if (acc < bestD || (acc === bestD && Math.abs(p - home) < Math.abs(bestP - home))) {
                            bestD = acc;
                            bestP = p;
                        }
                    }
                    while (p < home) {
                        swap(l, p);
                        p++;
                    }
                    while (at(pos, n) < bestP)
                        swap(l, at(pos, n));
                    while (at(pos, n) > bestP)
                        swap(l, at(pos, n) - 1);
                    cur += bestD;
                }
            }
            note();
            if (cur >= before)
                break;
        }
    };
    // annealing: a row among those with two nodes or more, uniformly; a position in it, uniformly. A pair of two components is not moved but still counts as a move and cools the temperature.
    const anneal = () => {
        const multi = R.map((r, l) => r.length >= 2 ? l : -1).filter(l => l >= 0);
        if (!multi.length)
            return;
        const cool = Math.pow(T_END / T0, 1 / MOVES);
        let T = T0;
        for (let k = 0; k < MOVES && cur > 0; k++, T *= cool) {
            nMoves++;
            const l = at(multi, Math.floor(rand() * multi.length)), r = at(R, l), p = Math.floor(rand() * (r.length - 1)), a = at(r, p), b = at(r, p + 1);
            if (cmp[a] !== cmp[b])
                continue;
            const d = delta(a, b);
            if (d <= 0 || rand() < Math.exp(-d / T)) {
                swap(l, p);
                cur += d;
                note();
            }
        }
    };
    for (let run = 0; run < RESTARTS && best > 0; run++) {
        if (run > 0) { // a restart: the rows the sweeps left, each row shuffled (Fisher-Yates), then the components put back in order (a stable sort)
            reset(seedRows);
            for (const r of R) {
                for (let k = r.length - 1; k > 0; k--) {
                    const j = Math.floor(rand() * (k + 1));
                    [r[k], r[j]] = [at(r, j), at(r, k)];
                }
                r.sort((x, y) => at(cmp, x) - at(cmp, y));
                r.forEach((n, i) => { pos[n] = i; });
            }
            cur = total(false);
        }
        anneal();
    }
    reset(bestRows);
    cur = best;
    sift();
    reset(bestRows);
    return { rows: bestRows.map(r => r.map(n => at(ids, n))), plainCrossings: total(true), cost: best, moves: nMoves };
}
