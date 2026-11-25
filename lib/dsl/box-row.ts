import {resolveLoopBacks} from '../loop-back-options.ts';
import type {Declares, IdsOf, RowHandleOf} from '../strict.ts';
import type {RowBand, RowOpts} from '../types/containers.ts';
import type {BoxBand} from '../types/text-bands.ts';
import {assertBoxChildren} from './box-children.ts';
import {spanRow, validateRowOptions, withRowHandle} from './row-options.ts';

export function boxRow<C extends BoxBand, const Id extends string = never>(
  children: C[], opts?: RowOpts & {id?: Id},
): RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>;
export function boxRow(children: BoxBand[], opts: RowOpts = {}): RowBand {
  validateRowOptions(opts);
  return buildBoxRow(children.slice(), opts);
}

export function buildBoxRow(children: BoxBand[], opts: RowOpts): RowBand {
  assertBoxChildren('row', children);
  const {cols, kids} = spanRow(children, opts.cols);
  const loopBack = opts.loopBack === undefined ? undefined : resolveLoopBacks('row()', opts.loopBack, kids.length);
  return withRowHandle({
    type: 'row', id: opts.id, cols, children: kids, gap: opts.gap ?? 16, arrows: opts.arrows ?? 'none',
    justify: opts.justify ?? 'stretch', itemWidth: opts.width, ...(loopBack ? {loopBack} : {}),
  }, opts);
}
