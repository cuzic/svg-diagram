// scatter() and controlChart(): the QC tools that are points and lines on a coordinate plane. Both only work out a plane() — axes that
// fit the data, the points, the lines, the labels — so layout, verify and every other check treat them as any plane.
import { niceUp, num } from './qc.js';
import { must } from './must.js';
/** How wide a text is, roughly (before layout knows the fonts): full-width characters take the whole size, the others 0.6 of it. */
const estimate = (s, size = 14) => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e80 ? size : size * 0.6), 0);
/** The plot's rough size in px, to turn pixel room (a legend row, a label beside a line) into units of an axis. */
const PLOT_W = 800, PLOT_H = (h) => Math.max(120, h - 60);
const unitsFor = (px, range, plotPx) => px / plotPx * range;
/** An axis over [lo, hi] with round ticks, `head` extra units above the last tick (room for a legend), and `tail` below the first. */
function fitAxis(lo, hi, label, fixed = {}, room = {}) {
    const span = hi - lo || Math.abs(hi) || 1, step = fixed.step ?? niceUp(span / 5);
    const pad = Math.max(span * 0.04, step * 0.2);
    let min = fixed.min ?? Math.floor((lo - pad) / step + 1e-9) * step;
    if (fixed.min === undefined && lo >= 0 && min < 0)
        min = 0; // a count, a rate, a temperature does not start below 0
    const top = fixed.max ?? Math.ceil((hi + pad) / step - 1e-9) * step;
    const ticks = [];
    for (let v = min, i = 0; v <= top + step * 1e-9 && i < 200; v = min + ++i * step)
        ticks.push(parseFloat(v.toPrecision(12)));
    return { ...(label ? { label } : {}), min, max: top + (room.head ?? 0), step, ticks };
}
// ---- legend rows -------------------------------------------------------------------------------------------------------------
const GLYPH = { dot: '●', ring: '○', cross: '✕' };
/** One row of legend entries in the room above the data, from the left edge, each as wide as its text. */
function legendRow(entries, x0, xRange, y) {
    const out = [];
    let at = x0;
    for (const e of entries) {
        const text = `${e.shape ? GLYPH[e.shape] + ' ' : ''}${e.text}`;
        out.push({ at: [at, y], text, anchor: 'start', tone: e.tone });
        at += unitsFor(estimate(text, 14) + 28, xRange, PLOT_W);
    }
    return out;
}
/** Colour + shape of the 1st to the 4th stratum: the shape differs too, so the strata stay apart without colour. */
const STRATA = [{ tone: 'accent', shape: 'dot' }, { tone: 'danger', shape: 'cross' }, { tone: 'text', shape: 'ring' }, { tone: 'muted', shape: 'dot' }];
export function correlation(xs, ys) {
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
        sxx += (must(xs[i]) - mx) ** 2;
        syy += (must(ys[i]) - my) ** 2;
        sxy += (must(xs[i]) - mx) * (must(ys[i]) - my);
    }
    const slope = sxx > 0 ? sxy / sxx : 0;
    return { r: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0, slope, intercept: my - slope * mx };
}
export function scatterOpts(points, opts) {
    if (!Array.isArray(points) || points.length < 2)
        throw new Error('scatter(points) needs at least two points');
    for (const [i, p] of points.entries())
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
            throw new Error(`scatter(): point ${i + 1} needs a finite x and y (got ${p.x}, ${p.y})`);
    const groups = opts.groups ?? [...new Set(points.flatMap(p => p.group === undefined ? [] : [p.group]))];
    if (groups.length > STRATA.length)
        throw new Error(`scatter(): at most ${STRATA.length} strata (got ${groups.length}: ${groups.join(', ')})`);
    for (const p of points)
        if (p.group !== undefined && !groups.includes(p.group))
            throw new Error(`scatter(): a point has group "${p.group}", which is not in groups (${groups.join(', ')})`);
    if (groups.length && points.some(p => p.group === undefined))
        throw new Error('scatter(): when some points have a group, every point needs one');
    const axisOf = (a) => typeof a === 'string' ? { label: a } : a;
    const ax = axisOf(opts.x), ay = axisOf(opts.y);
    const xs = points.map(p => p.x), ys = points.map(p => p.y), { r, slope, intercept } = correlation(xs, ys);
    for (const [name, a, vs] of [['x', ax, xs], ['y', ay, ys]]) {
        if (a.min !== undefined && Math.min(...vs) < a.min)
            throw new Error(`scatter(): the ${name} axis starts at ${a.min} but a point has ${name} = ${Math.min(...vs)}`);
        if (a.max !== undefined && Math.max(...vs) > a.max)
            throw new Error(`scatter(): the ${name} axis ends at ${a.max} but a point has ${name} = ${Math.max(...vs)}`);
    }
    if (opts.regression && (new Set(xs).size < 2 || new Set(ys).size < 2))
        throw new Error('scatter(): regression needs the x values and the y values to vary (r is not defined for a constant)');
    // the legend and the line of r each take a row above the data (two rows when there are both: they would meet on one)
    const rows = (groups.length > 1 ? 1 : 0) + (opts.regression ? 1 : 0);
    const height = opts.height ?? 320;
    const probe = fitAxis(Math.min(...ys), Math.max(...ys), undefined, { min: ay.min, max: ay.max, step: ay.step });
    const head = rows ? unitsFor(12 + 22 * rows, probe.max - (probe.min ?? 0), PLOT_H(height)) : 0;
    const x = fitAxis(Math.min(...xs), Math.max(...xs), ax.label, { min: ax.min, max: ax.max, step: ax.step });
    const y = fitAxis(Math.min(...ys), Math.max(...ys), ay.label, { min: ay.min, max: ay.max, step: ay.step }, { head });
    if (ax.ticks)
        x.ticks = ax.ticks;
    if (ay.ticks)
        y.ticks = ay.ticks;
    // the first labels of the two axes meet at the corner: the y axis leaves out its first one when neither is 0
    if (!ay.ticks && (y.min ?? 0) !== 0 && (x.min ?? 0) !== 0 && Array.isArray(y.ticks))
        y.ticks = y.ticks.map((t, i) => i === 0 ? { at: typeof t === 'number' ? t : t.at, label: '' } : t);
    const xMin = x.min ?? 0, yTop = y.max - head, rowY = (i) => y.max - unitsFor(18 + 22 * i, y.max - (y.min ?? 0), PLOT_H(height));
    const { labelRole, id, reveal, until, width } = opts;
    const pts = points.map(p => {
        const s = must(p.group === undefined ? STRATA[0] : STRATA[groups.indexOf(p.group)]);
        return { at: [p.x, p.y], ...(p.id ? { id: p.id } : {}), ...(p.label ? { label: p.label } : {}), tone: s.tone, shape: s.shape };
    });
    const lines = [], labels = [];
    if (groups.length > 1)
        labels.push(...legendRow(groups.map((g, i) => ({ text: g, ...must(STRATA[i]) })), xMin + (x.max - xMin) * 0.01, x.max - xMin, rowY(0)));
    if (opts.regression) {
        const sgn = (v) => v < 0 ? '−' : '';
        const rText = `r = ${sgn(r)}${Math.abs(Math.round(r * 100) / 100).toFixed(2)}　y = ${sgn(slope)}${num(Math.abs(slope))}x ${intercept < 0 ? '−' : '+'} ${num(Math.abs(intercept))}　n = ${points.length}`;
        // the line over the data's x range, cut where it would leave the plot
        let x1 = Math.min(...xs), x2 = Math.max(...xs);
        if (slope !== 0) {
            const at = (yy) => (yy - intercept) / slope;
            const lo = Math.min(at(y.min ?? 0), at(yTop)), hi = Math.max(at(y.min ?? 0), at(yTop));
            x1 = Math.max(x1, lo);
            x2 = Math.min(x2, hi);
        }
        if (x1 < x2)
            lines.push({ from: [x1, intercept + slope * x1], to: [x2, intercept + slope * x2], tone: 'muted', dashed: true });
        labels.push({ at: [x.max - (x.max - xMin) * 0.01, rowY(rows - 1)], anchor: 'end', tone: 'text', bold: true, text: rText });
    }
    return { ...(labelRole ? { labelRole } : {}), ...(id ? { id } : {}), ...(reveal === undefined ? {} : { reveal }), ...(until === undefined ? {} : { until }), ...(width === undefined ? {} : { width }), x, y, points: pts, lines, labels, height, grid: opts.grid ?? true };
}
// ---- control charts ----------------------------------------------------------------------------------------------------------
/** The factors for subgroups of size n = 2..10: A2 (X-bar limits from R-bar), D3 / D4 (R chart limits), d2. */
const FACTORS = {
    2: { A2: 1.88, D3: 0, D4: 3.267 }, 3: { A2: 1.023, D3: 0, D4: 2.575 }, 4: { A2: 0.729, D3: 0, D4: 2.282 }, 5: { A2: 0.577, D3: 0, D4: 2.114 },
    6: { A2: 0.483, D3: 0, D4: 2.004 }, 7: { A2: 0.419, D3: 0.076, D4: 1.924 }, 8: { A2: 0.373, D3: 0.136, D4: 1.864 }, 9: { A2: 0.337, D3: 0.184, D4: 1.816 },
    10: { A2: 0.308, D3: 0.223, D4: 1.777 },
};
/** The factor 3 / d2 for individuals (moving ranges of 2). */
const E2 = 2.66, D4_MR = 3.267;
/** What a chart plots and where its centre and limits are, from the data. */
export function controlStats(type, data, fixed = {}) {
    const N = data.length;
    if (N < 2)
        throw new Error(`controlChart(): needs at least two samples (got ${N})`);
    const flat = (k) => {
        if (!data.every(v => typeof v === 'number' && Number.isFinite(v)))
            throw new Error(`controlChart('${type}'): each sample must be a number (${k})`);
        return data;
    };
    const groups = () => {
        const g = data;
        if (!g.every(s => Array.isArray(s) && s.length >= 2 && s.every(Number.isFinite)))
            throw new Error(`controlChart('${type}'): each sample must be a subgroup: an array of at least two numbers`);
        const n = must(g[0]).length;
        if (!g.every(s => s.length === n))
            throw new Error(`controlChart('${type}'): every subgroup must have the same size (got ${[...new Set(g.map(s => s.length))].join(', ')})`);
        if (!(n in FACTORS))
            throw new Error(`controlChart('${type}'): the subgroup size must be 2 to 10 (got ${n})`);
        return g;
    };
    const attrs = () => {
        const a = data;
        if (!a.every(s => s && Number.isFinite(s.n) && Number.isFinite(s.d) && s.n > 0 && s.d >= 0 && s.d <= s.n * (type === 'u' ? Infinity : 1)))
            throw new Error(`controlChart('${type}'): each sample must be {n, d} with n > 0 and 0 <= d${type === 'u' ? '' : ' <= n'}`);
        return a;
    };
    const same = (cl, w, lo0 = -Infinity) => {
        const ws = typeof w === 'number' ? new Array(N).fill(w) : w;
        return { ucl: ws.map(x => cl + x), lcl: ws.map(x => Math.max(lo0, cl - x)) };
    };
    const sum = (xs) => xs.reduce((a, b) => a + b, 0);
    let cl, values, ucl, lcl;
    switch (type) {
        case 'x': {
            values = flat('x');
            const mr = values.slice(1).map((v, i) => Math.abs(v - must(values[i]))), mrBar = sum(mr) / mr.length;
            cl = sum(values) / N;
            ({ ucl, lcl } = same(cl, E2 * mrBar));
            break;
        }
        case 'mr': {
            const v = flat('mr');
            values = v.slice(1).map((x, i) => Math.abs(x - must(v[i])));
            cl = fixed.cl ?? sum(values) / values.length;
            ucl = new Array(values.length).fill(D4_MR * cl);
            lcl = new Array(values.length).fill(0);
            break;
        }
        case 'xbar':
        case 'r': {
            const g = groups(), n = must(g[0]).length, f = must(FACTORS[n]);
            const means = g.map(s => sum(s) / n), ranges = g.map(s => Math.max(...s) - Math.min(...s)), rBar = sum(ranges) / N;
            if (type === 'xbar') {
                values = means;
                cl = sum(means) / N;
                ({ ucl, lcl } = same(cl, f.A2 * rBar));
            }
            else {
                values = ranges;
                cl = fixed.cl ?? rBar;
                ucl = new Array(N).fill(f.D4 * cl);
                lcl = new Array(N).fill(f.D3 * cl);
            } // the limits are multiples of the centre line, a given one included
            break;
        }
        case 'p': {
            const a = attrs();
            values = a.map(s => s.d / s.n);
            cl = fixed.cl ?? sum(a.map(s => s.d)) / sum(a.map(s => s.n));
            if (!(cl > 0 && cl < 1))
                throw new Error(`controlChart('p'): the centre line is a share, between 0 and 1 (got ${num(cl)})`);
            ({ ucl, lcl } = same(cl, a.map(s => 3 * Math.sqrt(cl * (1 - cl) / s.n)), 0));
            ucl = ucl.map(u => Math.min(1, u));
            break;
        }
        case 'np': {
            const a = attrs(), n = must(a[0]).n;
            if (!a.every(s => s.n === n))
                throw new Error("controlChart('np'): every sample must inspect the same number (use 'p' when n varies)");
            if (!a.every(s => Number.isInteger(s.d)))
                throw new Error("controlChart('np'): d must be a whole number (the defectives counted)");
            const p = fixed.cl !== undefined ? fixed.cl / n : sum(a.map(s => s.d)) / sum(a.map(s => s.n));
            values = a.map(s => s.d);
            cl = n * p;
            if (!(p > 0 && p < 1))
                throw new Error(`controlChart('np'): the centre line must be between 0 and ${n} (got ${num(cl)})`);
            ({ ucl, lcl } = same(cl, 3 * Math.sqrt(n * p * (1 - p)), 0));
            break;
        }
        case 'c': {
            values = flat('c');
            if (!values.every(v => Number.isInteger(v) && v >= 0))
                throw new Error("controlChart('c'): each count must be a whole number >= 0");
            cl = fixed.cl ?? sum(values) / N;
            if (!(cl > 0))
                throw new Error(`controlChart('c'): the centre line must be > 0 (got ${num(cl)})`);
            ({ ucl, lcl } = same(cl, 3 * Math.sqrt(cl), 0));
            break;
        }
        case 'u': {
            const a = attrs();
            values = a.map(s => s.d / s.n);
            cl = fixed.cl ?? sum(a.map(s => s.d)) / sum(a.map(s => s.n));
            if (!(cl > 0))
                throw new Error(`controlChart('u'): the centre line must be > 0 (got ${num(cl)})`);
            ({ ucl, lcl } = same(cl, a.map(s => 3 * Math.sqrt(cl / s.n)), 0));
            break;
        }
        default: throw new Error(`controlChart(): type must be one of x, mr, xbar, r, p, np, c, u (got ${String(type)})`);
    }
    for (const k of ['cl', 'ucl', 'lcl'])
        if (fixed[k] !== undefined && !Number.isFinite(fixed[k]))
            throw new Error(`controlChart(): limits.${k} must be a finite number (got ${fixed[k]})`);
    // a fixed centre line moves the limits that are not fixed with it (they keep their distance from it)
    // x / xbar: the spread comes from the data, so a given centre line moves the limits with it (r, mr, p, np, c, u have worked them out from it above)
    if (fixed.cl !== undefined && cl !== fixed.cl) {
        const d = fixed.cl - cl;
        ucl = ucl.map(u => u + d);
        lcl = lcl.map(l => Math.max(type === 'x' || type === 'xbar' ? -Infinity : 0, l + d));
        cl = fixed.cl;
    }
    if (fixed.ucl !== undefined)
        ucl = ucl.map(() => must(fixed.ucl));
    if (fixed.lcl !== undefined)
        lcl = lcl.map(() => must(fixed.lcl));
    if (!(ucl.every(u => u > cl) && lcl.every(l => l < cl))) {
        if (fixed.cl !== undefined || fixed.ucl !== undefined || fixed.lcl !== undefined)
            throw new Error(`controlChart(): the limits must satisfy lcl < cl < ucl (got lcl ${num(Math.min(...lcl))}, cl ${num(cl)}, ucl ${num(Math.max(...ucl))})`);
        if (type !== 'p' && type !== 'np' && type !== 'c' && type !== 'u' && type !== 'mr' && type !== 'r')
            throw new Error(`controlChart('${type}'): the data does not vary (every limit would be ${cl}); there is nothing to chart`);
        if (!ucl.every(u => u > cl))
            throw new Error(`controlChart('${type}'): the data does not vary enough to have limits above the centre line (${cl})`);
    }
    return { cl, ucl, lcl, values };
}
const Y_LABEL = { x: '測定値 X', mr: '移動範囲 Rs', xbar: '群の平均', r: '範囲 R', p: '不良率 p', np: '不良数 np', c: '欠点数 c', u: '単位あたり欠点数 u' };
const RUN = 7;
/** The indices that break a rule: [outside the limits, in a run or a trend]. */
export function controlSignals(s) {
    const outside = new Set(), pattern = new Set(), v = s.values;
    v.forEach((x, i) => { if (x > must(s.ucl[i]) + 1e-12 || x < must(s.lcl[i]) - 1e-12)
        outside.add(i); });
    const side = v.map(x => Math.sign(x - s.cl));
    for (let i = 0; i + RUN <= v.length; i++) {
        const w = side.slice(i, i + RUN);
        if (w[0] !== 0 && w.every(t => t === w[0]))
            for (let k = i; k < i + RUN; k++)
                pattern.add(k);
        const d = v.slice(i + 1, i + RUN).map((x, k) => Math.sign(x - must(v[i + k])));
        if (d[0] !== 0 && d.every(t => t === d[0]))
            for (let k = i; k < i + RUN; k++)
                pattern.add(k);
    }
    return { outside, pattern };
}
export function controlChartOpts(type, data, opts = {}) {
    const s = controlStats(type, data, opts.limits), n = s.values.length;
    if (opts.at && opts.at.length !== (type === 'mr' ? data.length : n))
        throw new Error(`controlChart(): at needs one label per sample (${data.length}), got ${opts.at.length}`);
    const stepped = !(s.ucl.every(v => Math.abs(v - must(s.ucl[0])) < 1e-12) && s.lcl.every(v => Math.abs(v - must(s.lcl[0])) < 1e-12));
    const offset = type === 'mr' ? 1 : 0; // a moving range belongs to the sample it ends at, so it starts at 2
    const flagged = opts.rules === false ? { outside: new Set(), pattern: new Set() } : controlSignals(s);
    const height = opts.height ?? 320;
    const lo = Math.min(...s.values, ...s.lcl, s.cl), hi = Math.max(...s.values, ...s.ucl, s.cl);
    const legend = [];
    if (flagged.outside.size)
        legend.push({ text: '管理限界の外', tone: 'danger', shape: 'cross' });
    if ([...flagged.pattern].some(i => !flagged.outside.has(i)))
        legend.push({ text: `連・傾向（${RUN} 点）`, tone: 'danger', shape: 'ring' });
    const probe = fitAxis(lo, hi, undefined);
    const head = legend.length ? unitsFor(34, probe.max - (probe.min ?? 0), PLOT_H(height)) : 0;
    const y = fitAxis(lo, hi, opts.yLabel ?? Y_LABEL[type], { min: type === 'x' || type === 'xbar' ? undefined : 0 }, { head });
    if (type !== 'x' && type !== 'xbar' && lo >= 0)
        y.min = 0;
    const N = n + offset;
    const room = Math.ceil((estimate(stepped ? 'UCL（n による）' : 'UCL 00.0', 14) + 16) / PLOT_W * (N + 1)) + 1; // the labels beside the right end of the lines
    // every k-th number gets its text; k grows with the count and with the width of the labels (dates), so neighbours never touch
    const widest = opts.at ? Math.max(...opts.at.map(t => estimate(t, 14))) : estimate(String(N), 14);
    const every = Math.max(N > 30 ? 5 : N > 16 ? 2 : 1, Math.ceil((widest + 12) / (PLOT_W / (N + 1 + room))));
    const xTicks = Array.from({ length: N }, (_, i) => i + 1).filter(i => (i - 1) % every === 0).map(i => opts.at ? { at: i, label: must(opts.at[i - 1]) } : i);
    const x = { label: opts.xLabel ?? 'サンプル', min: 0, max: N + 1 + room, ticks: xTicks };
    // as many decimals as it takes to tell the limits from the centre line (about 3 digits of the spread between them)
    const spread = Math.max(...s.ucl) - Math.min(s.cl, ...s.lcl), places = opts.digits ?? (spread > 0 ? Math.max(0, 1 - Math.floor(Math.log10(spread))) : 2);
    const fmt = (v) => v.toFixed(places);
    const pt = (i) => [i + 1 + offset, must(s.values[i])];
    const points = s.values.map((_, i) => ({ at: pt(i), tone: flagged.outside.has(i) || flagged.pattern.has(i) ? 'danger' : 'accent', shape: flagged.outside.has(i) ? 'cross' : flagged.pattern.has(i) ? 'ring' : 'dot' }));
    const edge = (arr) => {
        // constant limits are one line; limits that vary with n step from sample to sample
        if (arr.every(v => Math.abs(v - must(arr[0])) < 1e-12))
            return [[0.5 + offset, must(arr[0])], [N + 0.5, must(arr[0])]];
        const out = [];
        arr.forEach((v, i) => { out.push([i + 0.5 + offset, v], [i + 1.5 + offset, v]); });
        return out;
    };
    const paths = [{ through: points.map(p => p.at) }];
    const lines = [{ from: [0.5 + offset, s.cl], to: [N + 0.5, s.cl], tone: 'accent', dashed: false }];
    const labels = [];
    const labelX = N + 0.8, gapY = unitsFor(22, y.max - (y.min ?? 0), PLOT_H(height)); // a label is about 21px tall
    // the lower limit is drawn unless it is 0 all along (a line on the axis); its number is left out where it is 0 or changes with n
    const hasLcl = s.lcl.some(v => v > 1e-12 || type === 'x' || type === 'xbar');
    const lclLabeled = hasLcl && (type === 'x' || type === 'xbar' || must(s.lcl[n - 1]) > 1e-12);
    const rows = [{ text: stepped ? 'UCL（n による）' : `UCL ${fmt(must(s.ucl[n - 1]))}`, at: must(s.ucl[n - 1]) }, { text: `CL ${fmt(s.cl)}`, at: s.cl }];
    if (lclLabeled)
        rows.push({ text: stepped ? 'LCL（n による）' : `LCL ${fmt(must(s.lcl[n - 1]))}`, at: must(s.lcl[n - 1]) });
    for (const [name, arr] of [['ucl', s.ucl], ['lcl', s.lcl]]) {
        if (name === 'lcl' && !hasLcl)
            continue;
        const e = edge(arr);
        if (e.length === 2)
            lines.push({ from: must(e[0]), to: must(e[1]), tone: 'danger', dashed: true });
        else
            paths.push({ through: e, tone: 'danger', dashed: true });
    }
    // labels of lines that sit closer than a text's height are pushed apart, so none of them touches another
    const placed = rows.sort((a, b) => b.at - a.at);
    for (let i = 1; i < placed.length; i++)
        if (must(placed[i - 1]).at - must(placed[i]).at < gapY)
            placed[i] = { ...must(placed[i]), at: must(placed[i - 1]).at - gapY };
    // a label that went down to the axis is lifted off it, and the ones above it make room (the labels sit a little above their lines then)
    const floor = (y.min ?? 0) + gapY * 1.15;
    for (let i = placed.length - 1, lowest = floor; i >= 0; i--) {
        if (must(placed[i]).at < lowest)
            placed[i] = { ...must(placed[i]), at: lowest };
        lowest = must(placed[i]).at + gapY;
    }
    for (const r of placed)
        labels.push({ at: [labelX, r.at], text: r.text, anchor: 'start', tone: r.text.startsWith('CL') ? 'accent' : 'danger', bold: true });
    const flagLabels = legend.length ? legendRow(legend, 0.5, x.max, y.max - head * 0.45) : [];
    const { labelRole, id, reveal, until, width } = opts;
    return { ...(labelRole ? { labelRole } : {}), ...(id ? { id } : {}), ...(reveal === undefined ? {} : { reveal }), ...(until === undefined ? {} : { until }), ...(width === undefined ? {} : { width }), x, y, points, paths, lines, labels: [...labels, ...flagLabels], height };
}
