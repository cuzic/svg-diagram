import { revealOf, scopeOpt, withAnchors, withHandle } from './shared.js';
export function cloud(boxes, opts = {}) {
    for (const k of ['a', 'b', 'c', 'd', 'd2'])
        if (boxes?.[k] == null)
            throw new Error(`cloud({a, b, c, d, d2}): box ${k} is missing`);
    if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 120 && Number.isFinite(opts.maxNodeW)))
        throw new Error(`cloud(): maxNodeW must be a number >= 120 (got ${opts.maxNodeW})`);
    for (const k of ['a', 'b', 'c', 'd', 'd2']) {
        const t = typeof boxes[k] === 'string' ? undefined : boxes[k].tone;
        if (t !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(t))
            throw new Error(`cloud(): box ${k} has tone ${String(t)}`);
    }
    const band = { type: 'cloud', a: boxes.a, b: boxes.b, c: boxes.c, d: boxes.d, d2: boxes.d2, ...(opts.assumptions === undefined ? {} : { assumptions: opts.assumptions.map(a => ({ ...a })) }), ...(opts.separator === undefined ? {} : { separator: opts.separator }), ...(opts.conflictLabel === undefined ? {} : { conflictLabel: opts.conflictLabel }), ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'cloud()'), ...revealOf(opts) };
    return withAnchors(withHandle(band, opts.id), ['a', 'b', 'c', 'd', 'd2'].map(k => { const v = boxes[k]; return typeof v === 'string' ? undefined : v.id; }));
}
