import { connectBand } from './defaults.js';
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
