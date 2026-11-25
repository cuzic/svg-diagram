import { connectBand } from './defaults.js';
export function callout(target, opts) {
    const side = opts?.side ?? 'above';
    if (!['above', 'below', 'left', 'right'].includes(side))
        throw new Error(`callout(): side must be above | below | left | right (got ${JSON.stringify(side)})`);
    if (typeof opts?.text !== 'string' || !opts.text.trim())
        throw new Error('callout(): text is required');
    return { ...connectBand(target, target, { arrow: 'end', tone: opts.tone, label: opts.text, chip: true, reveal: opts.reveal, until: opts.until }, false), annot: { kind: 'callout', side } };
}
