import { row } from '../dsl/row.js';
import { box } from '../dsl/text-bands.js';
/** A row of icon + label boxes (each a plain box({icon, title})). The label is required: an icon alone does not say what it means. */
export function iconRow(items, opts = {}) {
    if (items.length === 0)
        throw new Error('iconRow(): needs at least one item');
    return row(items.map(it => box({ icon: it.icon, title: it.label, body: it.body, tone: it.tone, iconTone: it.iconTone })), opts);
}
