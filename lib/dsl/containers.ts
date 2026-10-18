import {resolveLoopBacks} from '../loop-back.ts';
import type {ConnectBand, GridBand, GridOpts, GroupBand, RowBand, RowOpts, SpacerBand, GroupRowBand} from '../types/containers.ts';
import type {TextTone} from '../types/core.ts';
import type {Band} from '../types/index.ts';
import type {BoxBand, BoxTone} from '../types/text-bands.ts';
import type {Declares, IdsOf, HandleOf, Refers, RefsOf, RowHandleOf} from '../strict.ts';
import type {IconName} from '../icons.ts';
import {assertNoReveal, handleFor, withHandle} from './shared.ts';
import {box, group} from './text-bands.ts';

export function spacer(h: number, opts?: {reveal?: number}): SpacerBand {
  assertNoReveal(opts, 'spacer()');
  return {type: 'spacer', h};
}
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
// row()/grid() lay out boxes only. A group (or anything else) would silently render as an empty
// little box in plain JS (.mjs), where the types do not stop it, so fail loudly instead.
function assertBoxChildren(what: 'row' | 'grid', children: readonly {type?: string}[]): void {
  children.forEach((c, i) => {
    if (c?.type !== 'box') throw new Error(`${what}(): child ${i} is ${c?.type === undefined ? 'not a band' : `a ${c.type}()`}, but ${what}() takes box() children only. Stack groups vertically with d.add(group(...), group(...)) instead of placing them in a ${what}`);
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
export function row<C extends BoxBand | GroupBand | Exclude<Band, ConnectBand | SpacerBand | RowBand | GroupRowBand | GridBand>, const Id extends string = never>(children: C[], opts?: RowOpts & {id?: Id}): GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>;
export function row(rawChildren: Band[], opts: RowOpts = {}): RowBand | GroupRowBand {
  assertNoReveal(opts, 'row()'); // a row is shown with its children: give each child its own reveal
  // caption / stat / banner / table ... in a row: each goes into a frameless group (the same as writing group([x], {frame: false}) by hand)
  const wrappable = (c: Band) => c?.type !== undefined && !['box', 'group', 'connect', 'spacer', 'row', 'grouprow', 'grid'].includes(c.type);
  // the row placement (flex / width / span / col) moves to the wrapper, where the row reads it
  const wrap = (c: Band): GroupBand => {
    const {flex, width, span, col} = c as {flex?: number; width?: number; span?: number; col?: number};
    const place = Object.fromEntries(Object.entries({flex, width, span, col}).filter(([, v]) => v !== undefined));
    return group(c, {frame: false, ...place});
  };
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
/** One cell of iconRow(): the icon, the label beside it, and optionally a line of body. */
export interface IconRowItem {icon: IconName; label: string; body?: string; tone?: BoxTone; iconTone?: TextTone}
/** One node of an architecture diagram: an icon, centred and large, with its label under it (Visio's "shape"). */
export interface NodeOpts {
  icon: IconName;
  label: string;
  /** a second, muted line under the label (a type, an address) */
  sub?: string;
  /** side of the icon in px (default 48) */
  size?: number;
  /** `true` draws the box around it (default: no box) */
  frame?: boolean;
  tone?: BoxTone;
  iconTone?: TextTone;
  tag?: string;
  tagTone?: import('../types/core.ts').TagTone;
  flex?: number;
  width?: number;
  col?: number;
  span?: number;
}
/**
 * A node: `box({icon, iconAt: 'top', title: label, body: sub, frame})`, centred. Put nodes in row() / grid(), inside group() for a
 * network / VPC / region boundary, and join them with connect() by id.
 */
export function node<const Id extends string = never>(opts: NodeOpts & {id?: Id}): BoxBand & Declares<Id> & HandleOf<Id>;
export function node(opts: NodeOpts & {id?: string}): BoxBand {
  const {label, sub, size, frame, ...rest} = opts;
  if (size !== undefined && !(size >= 16 && size <= 96)) throw new Error(`node(): size must be between 16 and 96 px (got ${size})`);
  return box({...rest, title: label, ...(sub !== undefined ? {body: sub} : {}), iconAt: 'top', ...(size !== undefined ? {iconSize: size} : {}), ...(frame ? {} : {frame: false as const}), align: 'center'} as never) as BoxBand;
}
/** A row of icon + label boxes (each a plain box({icon, title})). The label is required: an icon alone does not say what it means. */
export function iconRow(items: IconRowItem[], opts: RowOpts = {}): RowBand {
  if (items.length === 0) throw new Error('iconRow(): needs at least one item');
  return row(items.map(it => box({icon: it.icon, title: it.label, body: it.body, tone: it.tone, iconTone: it.iconTone})), opts);
}
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
