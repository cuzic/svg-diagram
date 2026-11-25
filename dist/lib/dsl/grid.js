import { assertNoReveal } from './shared.js';
import { assertBoxChildren } from './box-children.js';
export function grid(children, opts) {
    if (!opts?.cols)
        throw new Error('grid(children, {cols}) needs cols');
    assertNoReveal(opts, 'grid()');
    assertBoxChildren('grid', children);
    return { type: 'grid', children, cols: opts.cols, gap: opts.gap ?? 16 };
}
