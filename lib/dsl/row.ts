import type {AreasBand, ConnectBand, GridBand, GroupBand, RowBand, RowOpts, SpacerBand, GroupRowBand} from '../types/containers.ts';
import type {Band} from '../types/index.ts';
import type {BoxBand} from '../types/text-bands.ts';
import type {Declares, IdsOf, Refers, RefsOf, RowHandleOf} from '../strict.ts';
import {buildBoxRow} from './box-row.ts';
import {spanRow, validateRowOptions, withRowHandle} from './row-options.ts';
import {wrappable, wrap} from './container-children.ts';

function assertRowChildren(children: readonly {type?: string}[]): void {
  children.forEach((c, i) => {
    if (c?.type !== 'box' && c?.type !== 'group') throw new Error(`row(): child ${i} is ${c?.type === undefined ? 'not a band' : `a ${c.type}()`}, but row() takes box() and group() children only`);
  });
}

// children: box() descriptors. justify: 'stretch' (default — fill the row,
// each child's share set by its `flex`, default 1) | 'center' | 'start'
// (fixed width per child, via each child's `width` or row-level `width`).
// arrows: 'between' draws a solid arrow from each child's right edge to the
// next child's left edge, vertically centered on the row.
//
// cols: N puts the row on a shared N-column grid instead (children take
// `span` columns, default 1, optionally starting at 1-based `col`). Rows with
// the same cols/gap have identical column edges, so a box spanning two
// columns lines up exactly over two single-column boxes in the next row.
//
// Groups may sit in a row too (side-by-side frames: Host | Cloud, or two containers next to each other). Their
// frames are stretched to the tallest one; give a group `flex` / `width` / `span` / `col` like a box. Groups
// in a row cannot be combined with `arrows: 'between'`.
export function row<C extends BoxBand, const Id extends string = never>(children: C[], opts?: RowOpts & {id?: Id}): RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>;
export function row<C extends BoxBand | GroupBand, const Id extends string = never>(children: C[], opts?: RowOpts & {id?: Id}): GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>;
export function row<C extends BoxBand | GroupBand | Exclude<Band, ConnectBand | SpacerBand | RowBand | GroupRowBand | GridBand | AreasBand>, const Id extends string = never>(children: C[], opts?: RowOpts & {id?: Id}): GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>;
export function row(rawChildren: Band[], opts: RowOpts = {}): RowBand | GroupRowBand {
  validateRowOptions(opts);
  const nested = rawChildren.findIndex(c => c?.type === 'areas');
  if (nested >= 0) throw new Error(`row(): child ${nested} is an areas() — a row's child takes one width in one row; put the areas() in a group: row([group([areas(...)]), ...])`);
  const children = rawChildren.map(c => wrappable(c) ? wrap(c) : c) as (BoxBand | GroupBand)[];
  if (!children.some(c => c?.type === 'group')) return buildBoxRow(children as BoxBand[], opts);
  if (opts.arrows === 'between') throw new Error("row(): arrows: 'between' cannot be used when a child is a group()");
  assertRowChildren(children);
  const {cols, kids} = spanRow(children, opts.cols);
  if (opts.loopBack !== undefined) throw new Error('row(): loopBack needs a row of boxes (a group in the row has no step anchor to loop to)');
  return withRowHandle({
    type: 'grouprow', id: opts.id, cols, children: kids, gap: opts.gap ?? 16, justify: opts.justify ?? 'stretch', itemWidth: opts.width,
  }, opts);
}
