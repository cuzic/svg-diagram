import { box } from './dsl/text-bands.js';
import { row } from './dsl/containers.js';
import { assertBoxTone } from './dsl/shared.js';
export function steps(items, opts = {}) {
    if (!Array.isArray(items) || items.length < 2)
        throw new Error('steps(): needs at least 2 items');
    if (opts.highlight !== undefined && (!Number.isInteger(opts.highlight) || opts.highlight < 1 || opts.highlight > items.length))
        throw new Error(`steps(): highlight must be a step number 1..${items.length} (got ${String(opts.highlight)})`);
    if (opts.highlightTone !== undefined && opts.highlightTone !== 'danger' && opts.highlightTone !== 'accent')
        throw new Error(`steps(): highlightTone must be 'danger' or 'accent' (got ${String(opts.highlightTone)})`);
    const boxes = items.map((it, i) => {
        if (typeof it?.title !== 'string' || !it.title.trim())
            throw new Error(`steps(): item ${i + 1} needs a title`);
        assertBoxTone(it.tone, `steps() item ${i + 1}`); // a solid tone would put the title's dark text on a solid fill
        const hot = opts.highlight === i + 1;
        const tone = hot ? opts.highlightTone ?? 'danger' : it.tone;
        return box({ title: it.title, ...(it.body === undefined ? {} : { body: it.body }), ...(it.icon === undefined ? {} : { icon: it.icon }), ...(it.tag === undefined ? {} : { tag: it.tag, ...(it.tagTone ? { tagTone: it.tagTone } : {}) }), ...(tone ? { tone } : {}), ...(opts.numbered ? { step: i + 1 } : {}) });
    });
    return row(boxes, { arrows: opts.arrows === false ? 'none' : 'between', ...(opts.gap === undefined ? {} : { gap: opts.gap }), ...(opts.id === undefined ? {} : { id: opts.id }), ...(opts.loopBack === undefined ? {} : { loopBack: opts.loopBack }) });
}
