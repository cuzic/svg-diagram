import { connectBand } from './defaults.js';
export function connect(from, to, opts = {}) {
    return connectBand(from, to, opts);
}
export function bracket(from, to, opts = {}) {
    const side = opts.side ?? 'below';
    if (side !== 'below' && side !== 'above')
        throw new Error(`bracket(): side must be 'below' or 'above' (got ${JSON.stringify(side)})`);
    if (opts.label !== undefined && (typeof opts.label !== 'string' || !opts.label.trim()))
        throw new Error('bracket(): label must not be empty (leave it out for none)');
    return { ...connectBand(from, to, { arrow: 'none', tone: opts.tone, label: opts.label, reveal: opts.reveal, until: opts.until }, false), annot: { kind: 'bracket', side } };
}
export function callout(target, opts) {
    const side = opts?.side ?? 'above';
    if (!['above', 'below', 'left', 'right'].includes(side))
        throw new Error(`callout(): side must be above | below | left | right (got ${JSON.stringify(side)})`);
    if (typeof opts?.text !== 'string' || !opts.text.trim())
        throw new Error('callout(): text is required');
    return { ...connectBand(target, target, { arrow: 'end', tone: opts.tone, label: opts.text, chip: true, reveal: opts.reveal, until: opts.until }, false), annot: { kind: 'callout', side } };
}
export function branch(from, targets, opts = {}) {
    // a target's via adds to the shared one (via: {from} on the fan and {to} on a target: both ends), it does not replace it
    return targets.map(t => Object.assign(connectBand(from, t.to, { route: 'elbow', ...opts, ...t, ...(opts.via !== undefined || t.via !== undefined ? { via: mergeVia(opts.via, t.via) } : {}) }), { fan: true })); // assign, not spread: the band keeps the options it was written with (GIVEN)
}
function mergeVia(a, b) {
    if (a === undefined || b === undefined)
        return a ?? b;
    if (a === 'group' || b === 'group')
        return 'group';
    return { ...a, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) };
}
