import { pertAlt, resolvePert } from '../semnet-pert.js';
import { semnetBandOptions } from '../semnet-band-options.js';
import { withAnchors, withHandle } from './shared.js';
function pertBand(tasks, opts = {}) {
    const spec = resolvePert(tasks, opts);
    return { type: 'chart', kind: 'pert', spec, alt: opts.alt ?? pertAlt(spec), ids: tasks.map(t => t.id), ...semnetBandOptions(opts) };
}
export function pert(tasks, opts = {}) {
    const band = pertBand(tasks, opts);
    return withHandle(withAnchors(band, band.ids), opts.id);
}
