import {resolveLoopBacks} from '../loop-back.ts';
import type {AreasBand, ConnectBand, GridBand, GroupBand, RowBand, RowOpts, SpacerBand, GroupRowBand} from '../types/containers.ts';
import type {Band} from '../types/index.ts';
import type {BoxBand} from '../types/text-bands.ts';
import type {Declares, IdsOf, Refers, RefsOf, RowHandleOf} from '../strict.ts';
import {assertNoReveal, assertOneOf, handleFor, withHandle} from './shared.ts';
import {assertBoxChildren} from './box-children.ts';
import {wrappable, wrap} from './container-children.ts';

// 'row#5' (the 5th column / child of the row with this id) and 'row#5-6' (columns 5..6): the ids layout.ts registers for a row({id}).
function columnId(id: string, n: number, to?: number): string {
  if (!Number.isInteger(n) || n < 1 || (to !== undefined && (!Number.isInteger(to) || to < n))) throw new Error(`row "${id}": col(${n}${to === undefined ? '' : `, ${to}`}) needs whole numbers, 1-based and in order`);
  return to === undefined || to === n ? `${id}#${n}` : `${id}#${n}-${to}`;
}
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
  assertOneOf(opts.arrows, ['between', 'none'], 'row() arrows');
  assertOneOf(opts.justify, ['stretch', 'center', 'start'], 'row() justify');
  assertNoReveal(opts, 'row()'); // a row is shown with its children: give each child its own reveal
  const nested = rawChildren.findIndex(c => c?.type === 'areas');
  if (nested >= 0) throw new Error(`row(): child ${nested} is an areas() — a row's child takes one width in one row; put the areas() in a group: row([group([areas(...)]), ...])`);
  const children = rawChildren.map(c => wrappable(c) ? wrap(c) : c) as (BoxBand | GroupBand)[];
  const hasGroup = children.some(c => c?.type === 'group');
  if (hasGroup) {
    if (opts.arrows === 'between') throw new Error("row(): arrows: 'between' cannot be used when a child is a group()");
    assertRowChildren(children);
  } else assertBoxChildren('row', children as BoxBand[]);
  const {cols, kids} = spanRow(children, opts.cols);
  if (opts.loopBack !== undefined && hasGroup) throw new Error('row(): loopBack needs a row of boxes (a group in the row has no step anchor to loop to)');
  const loopBack = opts.loopBack === undefined ? undefined : resolveLoopBacks('row()', opts.loopBack, kids.length);
  const band = hasGroup
    ? {type: 'grouprow' as const, id: opts.id, cols, children: kids, gap: opts.gap ?? 16, justify: opts.justify ?? 'stretch', itemWidth: opts.width}
    : {type: 'row' as const, id: opts.id, cols, children: kids as BoxBand[], gap: opts.gap ?? 16, arrows: opts.arrows ?? 'none', justify: opts.justify ?? 'stretch', itemWidth: opts.width, ...(loopBack ? {loopBack} : {})};
  if (!opts.id) return band;
  const id = opts.id;
  return Object.defineProperty(withHandle(band, id), 'col', {value: (n: number, to?: number) => {
    const slot = columnId(id, n, to);
    return Object.defineProperties({id: slot}, handleFor(slot));
  }});
}
// row({cols: [6, 6]}): one span per child, so the column count is their sum and no child carries `span` / `col`.
// The children are copied with their span filled in (a child that also sets `span` / `col` is a contradiction, so it throws).
function spanRow<C extends BoxBand | GroupBand>(children: C[], cols: number | number[] | undefined): {cols: number | undefined; kids: C[]} {
  if (cols === undefined) {
    // span / col only mean something on a grid: without cols the row shares its width by flex, and they would be dropped silently
    const i = children.findIndex(c => c.span !== undefined || c.col !== undefined);
    if (i >= 0) {
      const c = children[i] as {span?: number; col?: number};
      const what = [c.span !== undefined ? `span: ${c.span}` : '', c.col !== undefined ? `col: ${c.col}` : ''].filter(Boolean).join(', ');
      throw new Error(`row(): child ${i} has ${what}, but the row has no cols — give the row a grid (row([...], {cols: 12})) or size the child with flex / width`);
    }
  }
  if (!Array.isArray(cols)) {
    // row(children, {cols: 12}) with no child placed (no `span` / `col`): the children share the grid equally (12 / n columns each,
    // the remainder going to the first ones) instead of each being one column wide. A child with an explicit `span` / `col` opts out.
    const n = children.length;
    if (cols === undefined || n < 1 || n >= cols || children.some(c => c.span !== undefined || c.col !== undefined)) return {cols, kids: children};
    const base = Math.floor(cols / n), extra = cols % n;
    return {cols, kids: children.map((c, i) => Object.assign(Object.create(Object.getPrototypeOf(c), Object.getOwnPropertyDescriptors(c)) as C, {span: base + (i < extra ? 1 : 0)}))};
  }
  if (cols.length !== children.length) throw new Error(`row({cols: [${cols.join(', ')}]}) declares ${cols.length} spans for ${children.length} children`);
  if (cols.some(n => !Number.isInteger(n) || n < 1)) throw new Error(`row({cols: [${cols.join(', ')}]}): every span must be a whole number >= 1`);
  const kids = children.map((c, i) => {
    if (c.span !== undefined || c.col !== undefined) throw new Error(`row({cols: [...]}): child ${i} has its own span / col, but the row already gives it span ${cols[i]}`);
    return Object.assign(Object.create(Object.getPrototypeOf(c), Object.getOwnPropertyDescriptors(c)) as C, {span: cols[i]});
  });
  return {cols: cols.reduce((a, b) => a + b, 0), kids};
}
