import { group } from './group.js';
import { row } from './row.js';
import { chartAxes } from '../charts.js';
/**
 * パネル分割 (seaborn FacetGrid / relplot / catplot's col=): one panel per key of `data`, each drawn by `make`, titled with the key, laid out in rows.
 * The panels share their axes (`share`): pass the 4th argument on to the chart.
 *   .add(...facet({東京: a, 大阪: b, 名古屋: c}, (name, values, _i, axes) => histplot(values, {...axes}), {cols: 3}))
 */
export function facet(data, make, opts = {}) {
    const entries = Object.entries(data), cols = opts.cols ?? 2, share = opts.share ?? 'xy';
    if (entries.length === 0)
        throw new Error('facet(data) needs at least one panel');
    if (!Number.isInteger(cols) || cols < 1)
        throw new Error(`facet(): cols must be a whole number >= 1 (got ${opts.cols})`);
    if (!['xy', 'x', 'y', 'none'].includes(share))
        throw new Error(`facet(): share must be xy, x, y or none (got ${String(opts.share)})`);
    let axes = {};
    if (share !== 'none') {
        const seen = entries.map(([key, value], i) => { const b = make(key, value, i, {}); return b.type === 'chart' ? chartAxes(b) : undefined; }).filter((a) => a !== undefined);
        if (seen.length === 0) {
            if (opts.share !== undefined)
                throw new Error('facet(): share needs histplot / kdeplot / ecdfplot / displot / regplot / residplot panels (the others have no axis range to share)');
        }
        else {
            const span = (k) => [Math.min(...seen.map(a => a[k][0])), Math.max(...seen.map(a => a[k][1]))];
            axes = { ...(share.includes('x') ? { xRange: span('x') } : {}), ...(share.includes('y') ? { yRange: span('y') } : {}) };
        }
    }
    const panels = entries.map(([key, value], i) => group(make(key, value, i, axes), { title: key, span: 1, ...(opts.frame === false ? { frame: false } : {}) }));
    const rows = [];
    for (let i = 0; i < panels.length; i += cols)
        rows.push(row(panels.slice(i, i + cols), { cols }));
    return rows;
}
