// The numbers behind the seaborn-style distribution charts (boxplot, violinplot, stripplot, swarmplot, pointplot, barplot): pure functions
// of the values they are given. Nothing here is random — a jitter or a bootstrap would make the same data draw a different figure each time.
import { must } from './must.js';
// An element of a number array; NaN when out of range, which is what arithmetic on `undefined` gave before.
const g = (a, i) => a[i] ?? NaN;
const cell = (m, r, c) => m[r]?.[c] ?? NaN;
export const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export const meanOf = (xs) => sum(xs) / xs.length;
/** The sample standard deviation (n - 1); 0 for a single value. */
export const sdOf = (xs) => {
    if (xs.length < 2)
        return 0;
    const m = meanOf(xs);
    return Math.sqrt(sum(xs.map(x => (x - m) ** 2)) / (xs.length - 1));
};
/** The p-quantile of sorted values by linear interpolation (numpy's default, "type 7"). */
export function quantile(sorted, p) {
    const h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.min(sorted.length - 1, lo + 1);
    return g(sorted, lo) + (h - lo) * (g(sorted, hi) - g(sorted, lo));
}
export function boxStats(values) {
    const s = [...values].sort((a, b) => a - b), q1 = quantile(s, 0.25), median = quantile(s, 0.5), q3 = quantile(s, 0.75), iqr = q3 - q1;
    const inside = s.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
    return { n: s.length, min: g(s, 0), max: g(s, s.length - 1), q1, median, q3, lo: g(inside, 0), hi: g(inside, inside.length - 1), fliers: s.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr) };
}
// two-sided 95% critical values of Student's t for 1..30 degrees of freedom
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
export function tCritical95(df) {
    if (df < 1)
        return NaN;
    if (df <= 30)
        return g(T95, df - 1);
    const z = 1.959964; // Cornish-Fisher expansion about the normal quantile (error < 0.001 beyond 30 degrees of freedom)
    return z + (z ** 3 + z) / (4 * df) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df * df);
}
/** The error bar of a mean: the 95% confidence interval (t distribution), ±1 standard deviation, ±1 standard error, or the full range. Undefined when n = 1 (nothing to say about spread). */
export function errorBar(values, kind) {
    const n = values.length, m = meanOf(values);
    if (kind === 'none')
        return undefined;
    if (kind === 'range')
        return n < 2 ? undefined : [Math.min(...values), Math.max(...values)];
    if (n < 2)
        return undefined;
    const sd = sdOf(values), half = kind === 'sd' ? sd : kind === 'se' ? sd / Math.sqrt(n) : tCritical95(n - 1) * sd / Math.sqrt(n);
    return [m - half, m + half];
}
/** Gaussian kernel density estimate at each of `grid`, with Scott's bandwidth (the standard deviation times n^(-1/5): what seaborn uses). Integrates to 1. */
export function kde(values, grid, bwScale = 1) {
    const n = values.length, bw = Math.max(sdOf(values) * n ** -0.2 * bwScale, 1e-12);
    const k = 1 / (n * bw * Math.sqrt(2 * Math.PI));
    return { bw, density: grid.map(g => k * sum(values.map(v => Math.exp(-0.5 * ((g - v) / bw) ** 2)))) };
}
/**
 * A beeswarm: each value gets a sideways offset (px) so that no two points of diameter `d` touch, as near the centre line as it can be.
 * `at` are the positions along the value axis (px). Returns the offsets in the order of `at`, or undefined when a point would need
 * to go further than `maxOff` from the centre.
 */
export function swarmOffsets(at, d, maxOff) {
    const order = at.map((_v, i) => i).sort((a, b) => g(at, a) - g(at, b)), placed = [], out = new Array(at.length).fill(0);
    for (const i of order) {
        const u = g(at, i), near = placed.filter(p => Math.abs(p.u - u) < d);
        const cands = [0, ...near.flatMap(p => { const dx = Math.sqrt(d * d - (p.u - u) ** 2); return [p.off + dx, p.off - dx]; })].sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
        const off = cands.find(x => near.every(p => Math.hypot(p.u - u, p.off - x) >= d - 1e-6));
        if (off === undefined || Math.abs(off) > maxOff)
            return undefined;
        placed.push({ u, off });
        out[i] = off;
    }
    return out;
}
/** Counts of `values` in the classes between `edges` (a value on an edge belongs to the class above it, the largest value to the last class). */
export function binCounts(values, edges) {
    const n = edges.length - 1, out = new Array(n).fill(0), w = (g(edges, n) - g(edges, 0)) / n;
    for (const v of values) {
        const k = Math.min(n - 1, Math.max(0, Math.floor((v - g(edges, 0)) / w + 1e-9)));
        out[k] = (out[k] ?? NaN) + 1;
    }
    return out;
}
/** The index of the class of `edges` that `v` falls in (the same rule as binCounts). */
export function binIndex(v, edges) {
    const n = edges.length - 1;
    return Math.min(n - 1, Math.max(0, Math.floor((v - g(edges, 0)) / ((g(edges, n) - g(edges, 0)) / n) + 1e-9)));
}
/**
 * A least-squares polynomial of `order` 1..3 (the x values are centred and scaled first, so a high order stays well conditioned) with the
 * analytic 95% confidence band of the fitted mean: t(n - p) * s * sqrt(v' (X'X)^-1 v).
 */
export function polyFit(xs, ys, order) {
    const n = xs.length, p = order + 1, mx = meanOf(xs), sx = sdOf(xs) || 1;
    const row = (x) => { const z = (x - mx) / sx; return Array.from({ length: p }, (_q, k) => z ** k); };
    const X = xs.map(row);
    const A = Array.from({ length: p }, (_q, i) => Array.from({ length: p }, (_r, j) => sum(X.map(r => g(r, i) * g(r, j)))));
    const b = Array.from({ length: p }, (_q, i) => sum(X.map((r, k) => g(r, i) * g(ys, k))));
    // Gauss-Jordan on [A | I | b]: the solution and the inverse together
    const M = A.map((r, i) => [...r, ...Array.from({ length: p }, (_q, j) => i === j ? 1 : 0), g(b, i)]);
    for (let c = 0; c < p; c++) {
        let piv = c;
        for (let r = c + 1; r < p; r++)
            if (Math.abs(cell(M, r, c)) > Math.abs(cell(M, piv, c)))
                piv = r;
        const rowC = must(M[c]), rowPiv = must(M[piv]);
        M[c] = rowPiv;
        M[piv] = rowC;
        const d = cell(M, c, c);
        if (Math.abs(d) < 1e-12)
            throw new Error('polyFit: the x values do not determine a polynomial of this order');
        const mc = must(M[c]).map(v => v / d);
        M[c] = mc;
        for (let r = 0; r < p; r++)
            if (r !== c) {
                const f = cell(M, r, c);
                M[r] = must(M[r]).map((v, k) => v - f * g(mc, k));
            }
    }
    const beta = M.map(r => g(r, 2 * p)), inv = M.map(r => r.slice(p, 2 * p));
    const at = (x) => sum(row(x).map((v, k) => v * g(beta, k)));
    const my = meanOf(ys), rss = sum(xs.map((x, i) => (g(ys, i) - at(x)) ** 2)), tss = sum(ys.map(y => (y - my) ** 2));
    const df = n - p, s = df > 0 ? Math.sqrt(rss / df) : NaN, t = tCritical95(df);
    const half = df > 0 ? (x) => { const v = row(x); return t * s * Math.sqrt(Math.max(0, sum(v.map((vi, i) => vi * sum(must(inv[i]).map((q, j) => q * g(v, j))))))); } : undefined;
    return { order, coef: beta, r2: tss > 0 ? 1 - rss / tss : 1, n, at, rss, ...(half ? { half } : {}) };
}
/**
 * A 2-D Gaussian kernel density estimate on the grid gx × gy (z[j][i] is at gx[i], gy[j]); each axis has Scott's bandwidth for two dimensions
 * (the standard deviation times n^(-1/6)).
 */
export function kde2d(xs, ys, gx, gy) {
    const n = xs.length, bwx = Math.max(sdOf(xs) * n ** (-1 / 6), 1e-12), bwy = Math.max(sdOf(ys) * n ** (-1 / 6), 1e-12), k = 1 / (n * 2 * Math.PI * bwx * bwy);
    const ex = gx.map(g => xs.map(x => Math.exp(-0.5 * ((g - x) / bwx) ** 2))), ey = gy.map(g => ys.map(y => Math.exp(-0.5 * ((g - y) / bwy) ** 2)));
    return { bwx, bwy, z: gy.map((_q, j) => gx.map((_r, i) => k * sum(xs.map((_s, m) => cell(ex, i, m) * cell(ey, j, m))))) };
}
/**
 * Agglomerative clustering with average linkage (UPGMA) on the Euclidean distances between the rows of `data`. Leaves are 0..n-1, the k-th merge
 * makes node n + k. Ties go to the pair with the smaller indices, so the same data always gives the same tree.
 */
export function averageLinkage(data) {
    const n = data.length, dist = (a, b) => Math.sqrt(sum(a.map((v, i) => (v - g(b, i)) ** 2)));
    const live = new Map(data.map((_r, i) => [i, { size: 1 }]));
    const d = new Map(), key = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;
    for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
            d.set(key(i, j), dist(must(data[i]), must(data[j])));
    const out = [];
    for (let step = 0; step < n - 1; step++) {
        let best, bd = Infinity;
        const ids = [...live.keys()].sort((x, y) => x - y);
        for (let x = 0; x < ids.length; x++)
            for (let y = x + 1; y < ids.length; y++) {
                const ix = must(ids[x]), iy = must(ids[y]), v = must(d.get(key(ix, iy)));
                if (v < bd - 1e-12) {
                    bd = v;
                    best = [ix, iy];
                }
            }
        const [a, b] = must(best), sa = must(live.get(a)).size, sb = must(live.get(b)).size, id = n + step;
        for (const o of ids)
            if (o !== a && o !== b)
                d.set(key(id, o), (sa * must(d.get(key(a, o))) + sb * must(d.get(key(b, o)))) / (sa + sb));
        live.delete(a);
        live.delete(b);
        live.set(id, { size: sa + sb });
        out.push({ a, b, height: bd, size: sa + sb });
    }
    return out;
}
/** The leaves of a tree from averageLinkage in dendrogram order (the child holding the smaller leaf first), and where each node sits (the mean of its children's positions). */
export function dendrogramOrder(merges, n) {
    const node = (id) => must(merges[id - n]);
    const leaves = (id) => id < n ? [id] : [...leaves(node(id).a), ...leaves(node(id).b)];
    const min = (id) => id < n ? id : Math.min(min(node(id).a), min(node(id).b));
    const kids = (id) => { const m = node(id); return min(m.a) <= min(m.b) ? [m.a, m.b] : [m.b, m.a]; };
    const seq = (id) => id < n ? [id] : kids(id).flatMap(seq);
    const order = n === 1 ? [0] : seq(n + merges.length - 1), at = new Map(order.map((leaf, i) => [leaf, i]));
    const pos = new Array(n + merges.length).fill(0);
    for (let i = 0; i < n; i++)
        pos[i] = must(at.get(i));
    merges.forEach((m, k) => { pos[n + k] = (g(pos, m.a) + g(pos, m.b)) / 2; });
    void leaves;
    return { order, pos };
}
/**
 * LOWESS (locally weighted linear regression, Cleveland 1979) as a function of x: at x0 the nearest `frac` of the points are fitted by a
 * weighted line (tricube weights), and `iterations` rounds of bisquare weights on the residuals make it robust to outliers (statsmodels'
 * defaults: frac 2/3, 3 iterations). Evaluated at any x, so a smooth curve can be drawn without interpolating between data points.
 */
export function lowessFit(xs, ys, frac = 2 / 3, iterations = 3) {
    const n = xs.length, k = Math.max(2, Math.min(n, Math.ceil(frac * n)));
    let rw = new Array(n).fill(1);
    const at = (x0, w) => {
        const d = xs.map(x => Math.abs(x - x0)), h = Math.max(g([...d].sort((a, b) => a - b), k - 1), 1e-12);
        let sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
        d.forEach((di, i) => {
            const u = di / h;
            if (u >= 1)
                return;
            const wi = g(w, i) * (1 - u ** 3) ** 3;
            sw += wi;
            swx += wi * g(xs, i);
            swy += wi * g(ys, i);
            swxx += wi * g(xs, i) ** 2;
            swxy += wi * g(xs, i) * g(ys, i);
        });
        if (sw <= 0)
            return meanOf(ys);
        const den = sw * swxx - swx * swx;
        // a window whose points share (nearly) one x has no slope: use the weighted mean
        if (Math.abs(den) < 1e-12 * Math.max(1, sw * swxx))
            return swy / sw;
        const slope = (sw * swxy - swx * swy) / den;
        return (swy - slope * swx) / sw + slope * x0;
    };
    for (let it = 0; it < iterations; it++) {
        const res = xs.map((x, i) => g(ys, i) - at(x, rw)), s = [...res.map(Math.abs)].sort((a, b) => a - b), mid = s.length >> 1, med = s.length % 2 ? g(s, mid) : (g(s, mid - 1) + g(s, mid)) / 2;
        if (med < 1e-12)
            break;
        rw = res.map(r => { const u = Math.abs(r) / (6 * med); return u < 1 ? (1 - u * u) ** 2 : 0; });
    }
    const final = rw;
    return x0 => at(x0, final);
}
