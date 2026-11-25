import { assertNoReveal, withHandle } from './shared.js';
export function people(total, countIn, opts = {}) {
    assertNoReveal(opts, 'people()');
    if (!Number.isInteger(total) || total < 1 || total > 400)
        throw new Error(`people(): total must be a whole number from 1 to 400 (got ${total})`);
    const [count, count2] = typeof countIn === 'number' ? [countIn, 0] : countIn;
    if (!Number.isInteger(count) || count < 0 || !Number.isInteger(count2) || count2 < 0 || count + count2 > total)
        throw new Error(`people(): count must be a whole number from 0 to total (${total}), or [k1, k2] with k1 + k2 <= total (got ${JSON.stringify(countIn)})`);
    const cols = opts.cols ?? (total <= 10 ? total : Math.ceil(Math.sqrt(total)));
    if (!Number.isInteger(cols) || cols < 1 || cols > total)
        throw new Error(`people(): cols must be a whole number from 1 to total (got ${cols})`);
    const size = opts.size ?? 28, gap = opts.gap ?? 8;
    if (!(size >= 12 && size <= 96))
        throw new Error(`people(): size must be from 12 to 96 px (got ${size})`);
    if (!(gap >= 0))
        throw new Error(`people(): gap must be >= 0 (got ${gap})`);
    if (opts.align !== undefined && opts.align !== 'left' && opts.align !== 'center')
        throw new Error(`people(): align must be 'left' or 'center' (got ${opts.align})`);
    for (const k of ['tone', 'tone2', 'rest']) {
        const v = opts[k];
        if (v !== undefined && !['accent', 'danger', 'muted'].includes(v))
            throw new Error(`people(): ${k} must be 'accent', 'danger' or 'muted' (got ${v})`);
    }
    if (opts.side !== undefined) {
        if (typeof opts.side.value !== 'string' || !opts.side.value)
            throw new Error('people(): side needs a value (the text beside the grid)');
        if (opts.side.size !== undefined && opts.side.size !== 'stat' && opts.side.size !== 'display')
            throw new Error(`people(): side.size must be 'stat' or 'display' (got ${opts.side.size})`);
        if (opts.side.tone !== undefined && !['accent', 'danger', 'muted'].includes(opts.side.tone))
            throw new Error(`people(): side.tone must be 'accent', 'danger' or 'muted' (got ${opts.side.tone})`);
    }
    return withHandle({ type: 'people', total, count, cols, size, gap, align: opts.align ?? 'center', tone: opts.tone ?? 'accent', tone2: opts.tone2 ?? ((opts.tone ?? 'accent') === 'danger' ? 'accent' : 'danger'), count2, rest: opts.rest ?? 'muted', ...(opts.side ? { side: opts.side } : {}), alt: opts.alt ?? (count2 ? `${count} + ${count2} / ${total}` : `${count} / ${total}`), ...(opts.id === undefined ? {} : { id: opts.id }) }, opts.id);
}
