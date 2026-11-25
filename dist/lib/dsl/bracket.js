import { connectBand } from './defaults.js';
export function bracket(from, to, opts = {}) {
    const side = opts.side ?? 'below';
    if (side !== 'below' && side !== 'above')
        throw new Error(`bracket(): side must be 'below' or 'above' (got ${JSON.stringify(side)})`);
    if (opts.label !== undefined && (typeof opts.label !== 'string' || !opts.label.trim()))
        throw new Error('bracket(): label must not be empty (leave it out for none)');
    return { ...connectBand(from, to, { arrow: 'none', tone: opts.tone, label: opts.label, reveal: opts.reveal, until: opts.until }, false), annot: { kind: 'bracket', side } };
}
