import type {GroupBand, GroupRowBand, RowBand, RowOpts} from '../types/containers.ts';
import type {BoxBand} from '../types/text-bands.ts';
import {assertNoReveal, assertOneOf, handleFor, withHandle} from './shared.ts';

// 'row#5' (the 5th column / child of the row with this id) and 'row#5-6' (columns 5..6): the ids layout.ts registers for a row({id}).
function columnId(id: string, n: number, to?: number): string {
  if (!Number.isInteger(n) || n < 1 || (to !== undefined && (!Number.isInteger(to) || to < n))) throw new Error(`row "${id}": col(${n}${to === undefined ? '' : `, ${to}`}) needs whole numbers, 1-based and in order`);
  return to === undefined || to === n ? `${id}#${n}` : `${id}#${n}-${to}`;
}

export function validateRowOptions(opts: RowOpts): void {
  assertOneOf(opts.arrows, ['between', 'none'], 'row() arrows');
  assertOneOf(opts.justify, ['stretch', 'center', 'start'], 'row() justify');
  assertNoReveal(opts, 'row()'); // a row is shown with its children: give each child its own reveal
}

export function withRowHandle<T extends RowBand | GroupRowBand>(band: T, opts: RowOpts): T {
  if (!opts.id) return band;
  const id = opts.id;
  return Object.defineProperty(withHandle(band, id), 'col', {value: (n: number, to?: number) => {
    const slot = columnId(id, n, to);
    return Object.defineProperties({id: slot}, handleFor(slot));
  }});
}

// row({cols: [6, 6]}): one span per child, so the column count is their sum and no child carries `span` / `col`.
// The children are copied with their span filled in (a child that also sets `span` / `col` is a contradiction, so it throws).
export function spanRow<C extends BoxBand | GroupBand>(children: C[], cols: number | number[] | undefined): {cols: number | undefined; kids: C[]} {
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
