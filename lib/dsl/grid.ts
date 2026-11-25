
import type {GridBand, GridOpts} from '../types/containers.ts';
import type {BoxBand} from '../types/text-bands.ts';
import type {Declares, IdsOf} from '../strict.ts';
import {assertNoReveal} from './shared.ts';
import {assertBoxChildren} from './box-children.ts';

// children: box() descriptors, laid out in `cols` columns (wraps to
// additional rows automatically). Every cell in the same grid-row shares
// that row's tallest cell's height, same as row().
export function grid<C extends BoxBand>(children: C[], opts: GridOpts): GridBand & Declares<IdsOf<C>>;
export function grid(children: BoxBand[], opts: GridOpts): GridBand {
  if (!opts?.cols) throw new Error('grid(children, {cols}) needs cols');
  assertNoReveal(opts, 'grid()');
  assertBoxChildren('grid', children);
  return {type: 'grid', children, cols: opts.cols, gap: opts.gap ?? 16};
}
