import { ftaIds, ftaResolve, ftaSinglePoints, ftaQuant } from '../fta.js';
import { revealOf, scopeOpt, withAnchors, withHandle } from './shared.js';
export function faultTree(top, opts = {}) {
    if (opts.maxNodeW !== undefined && opts.maxNodeW !== 'auto' && !(typeof opts.maxNodeW === 'number' && Number.isFinite(opts.maxNodeW) && opts.maxNodeW >= 80))
        throw new Error(`faultTree(): maxNodeW must be a number >= 80 or 'auto' (got ${String(opts.maxNodeW)})`);
    if (opts.cutSets !== undefined && typeof opts.cutSets !== 'boolean')
        throw new Error(`faultTree(): cutSets is true or false (got ${String(opts.cutSets)})`);
    const { root } = ftaResolve(top); // every mistake in the tree throws here, naming the event
    if (opts.cutSets)
        ftaSinglePoints(root); // throws when the tree has too many cut sets to find them
    if (opts.quant !== undefined && typeof opts.quant !== 'boolean')
        throw new Error(`faultTree(): quant is true or false (got ${String(opts.quant)})`);
    if (opts.quantPeriod !== undefined && (typeof opts.quantPeriod !== 'string' || !opts.quantPeriod.trim() || !opts.quant))
        throw new Error('faultTree(): quantPeriod is a non-empty string, and goes with quant: true');
    if (opts.quant)
        ftaQuant(root, opts.quantPeriod, opts.words); // throws for an event without p
    const band = { type: 'fta', root: top, ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(opts.cutSets === undefined ? {} : { cutSets: opts.cutSets }), ...(opts.quant === undefined ? {} : { quant: opts.quant }), ...(opts.quantPeriod === undefined ? {} : { quantPeriod: opts.quantPeriod }), ...(opts.words === undefined ? {} : { words: { ...opts.words } }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'faultTree()'), ...revealOf(opts) };
    return withAnchors(withHandle(band, opts.id), ftaIds(top));
}
