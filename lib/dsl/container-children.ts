
import type {GroupBand} from '../types/containers.ts';
import type {Band} from '../types/index.ts';
import {group} from './group.ts';

// caption / banner / table ... (a stat() is a box) in a row() or an areas() cell: each goes into a frameless group (the same as writing
// group([x], {frame: false}) by hand). Boxes and groups are placed as they are; the bands that place others (row, grid, areas) and
// the ones that are not content (connect, spacer) are not wrapped (row() and areas() refuse them).
const UNWRAPPED: readonly string[] = ['box', 'group', 'connect', 'spacer', 'row', 'grouprow', 'grid', 'areas'];
export function wrappable(c: Band): boolean { return c?.type !== undefined && !UNWRAPPED.includes(c.type); }
// the row placement (flex / width / span / col) moves to the wrapper, where the row reads it
export function wrap(c: Band): GroupBand {
  const {flex, width, span, col} = c as {flex?: number; width?: number; span?: number; col?: number};
  const place = Object.fromEntries(Object.entries({flex, width, span, col}).filter(([, v]) => v !== undefined));
  return group(c, {frame: false, ...place});
}
