import { bowtieCheck } from '../bowtie.js';
import { revealOf, scopeOpt, withHandle } from './shared.js';
export function bowtie(input, opts = {}) {
    bowtieCheck(input);
    if (opts.maxNodeW !== undefined && opts.maxNodeW !== 'auto' && !(typeof opts.maxNodeW === 'number' && Number.isFinite(opts.maxNodeW) && opts.maxNodeW >= 80))
        throw new Error(`bowtie(): maxNodeW must be a number >= 80 or 'auto' (got ${String(opts.maxNodeW)})`);
    const side = (s) => ({ label: s.label, ...(s.barriers === undefined ? {} : { barriers: [...s.barriers] }) });
    const band = { type: 'bowtie', ...(input.hazard === undefined ? {} : { hazard: input.hazard }), event: input.top, threats: input.threats.map(side), consequences: input.consequences.map(side), ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'bowtie()'), ...revealOf(opts) };
    return withHandle(band, opts.id);
}
