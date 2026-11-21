// Source references stay lazy until the CLI resolves a finding.
import { sourceOf } from './source-ref.js';
/** The first marked part is the primary location; the other marked parts are related. */
export function at(band, ...relatedBands) {
    const loc = band && sourceOf(band);
    if (!relatedBands.length)
        return loc ? { loc } : {};
    return fromSources([loc, ...relatedBands.map(b => sourceOf(b))]);
}
export function fromSources(refs) {
    const sources = new Set();
    // Keep one primary and at most ten distinct related locations.
    for (const ref of refs) {
        if (ref)
            sources.add(ref);
        if (sources.size === 11)
            break;
    }
    const [loc, ...related] = sources;
    return loc ? { loc, ...(related.length ? { related } : {}) } : {};
}
