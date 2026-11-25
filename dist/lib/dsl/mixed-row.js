import { spanRow, withRowHandle } from './row-options.js';
import { wrappable, wrap } from './container-children.js';
function assertRowChildren(children) {
    children.forEach((c, i) => {
        if (c?.type !== 'box' && c?.type !== 'group')
            throw new Error(`row(): child ${i} is ${c?.type === undefined ? 'not a band' : `a ${c.type}()`}, but row() takes box() and group() children only`);
    });
}
export function normalizeRowChildren(rawChildren) {
    const nested = rawChildren.findIndex(c => c?.type === 'areas');
    if (nested >= 0)
        throw new Error(`row(): child ${nested} is an areas() — a row's child takes one width in one row; put the areas() in a group: row([group([areas(...)]), ...])`);
    return rawChildren.map(c => wrappable(c) ? wrap(c) : c);
}
export function buildMixedRow(children, opts) {
    if (opts.arrows === 'between')
        throw new Error("row(): arrows: 'between' cannot be used when a child is a group()");
    assertRowChildren(children);
    const { cols, kids } = spanRow(children, opts.cols);
    if (opts.loopBack !== undefined)
        throw new Error('row(): loopBack needs a row of boxes (a group in the row has no step anchor to loop to)');
    return withRowHandle({
        type: 'grouprow', id: opts.id, cols, children: kids, gap: opts.gap ?? 16, justify: opts.justify ?? 'stretch', itemWidth: opts.width,
    }, opts);
}
