import { buildBoxRow } from './box-row.js';
import { validateRowOptions } from './row-options.js';
import { buildMixedRow, normalizeRowChildren } from './mixed-row.js';
export function row(rawChildren, opts = {}) {
    validateRowOptions(opts);
    const children = normalizeRowChildren(rawChildren);
    if (!children.some(c => c?.type === 'group'))
        return buildBoxRow(children, opts);
    return buildMixedRow(children, opts);
}
