import { resolveLoopBacks } from '../loop-back-options.js';
import { assertBoxChildren } from './box-children.js';
import { spanRow, validateRowOptions, withRowHandle } from './row-options.js';
export function boxRow(children, opts = {}) {
    validateRowOptions(opts);
    return buildBoxRow(children.slice(), opts);
}
export function buildBoxRow(children, opts) {
    assertBoxChildren('row', children);
    const { cols, kids } = spanRow(children, opts.cols);
    const loopBack = opts.loopBack === undefined ? undefined : resolveLoopBacks('row()', opts.loopBack, kids.length);
    return withRowHandle({
        type: 'row', id: opts.id, cols, children: kids, gap: opts.gap ?? 16, arrows: opts.arrows ?? 'none',
        justify: opts.justify ?? 'stretch', itemWidth: opts.width, ...(loopBack ? { loopBack } : {}),
    }, opts);
}
