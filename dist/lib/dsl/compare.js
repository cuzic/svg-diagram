import { withHandle } from './shared.js';
import { chartBandOptions } from '../chart-band-options.js';
import { compareAlt, resolveCompare } from '../charts-compare.js';
export function compareBand(rows, cols, cells, opts) {
    const spec = resolveCompare(rows, cols, cells, opts);
    return { type: 'chart', kind: 'compare', spec, alt: opts.alt ?? compareAlt(spec), ids: [], ...chartBandOptions('compare', opts) };
}
export function compare(rows, cols, cells, opts = {}) {
    return withHandle(compareBand(rows, cols, cells, opts), opts.id);
}
