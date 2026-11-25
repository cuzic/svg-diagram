import type { AreasBand, AreasOpts, ConnectBand, GridBand, GroupBand, RowBand, SpacerBand, GroupRowBand } from '../types/containers.ts';
import type { Band } from '../types/index.ts';
import type { BoxBand } from '../types/text-bands.ts';
import type { Declares, IdsOf, HandleOf, Refers, RefsOf } from '../strict.ts';
/** What an areas() cell holds: a box, a group, or one band that a row would wrap (caption, table ...; a stat() is a box). */
export type AreaContent = BoxBand | GroupBand | Exclude<Band, ConnectBand | SpacerBand | RowBand | GroupRowBand | GridBand | AreasBand>;
/**
 * Places bands by the named areas of a template, like CSS grid-template-areas (ADR 0069 D3):
 *
 *     areas(`
 *       head  memo  convs
 *       .     note  note
 *     `, {head: group([...], {title}), memo: box({...}), convs: group([...]), note: caption('...')}, {cols: [4, 3, 4], gap: 64})
 *
 * One row per line, cells split by spaces, `.` an empty cell; every name covers a rectangle and is the id of what it holds, so
 * `connect('memo:right', 'c1:left')` works as written. Columns share the width by `cols` (default equal); a row is as tall as what
 * its cells need, a cell spanning rows as tall as those rows, and boxes / group frames are stretched to their cell (a framed group
 * centres its content, as in a row). The template places and sizes the cells, so their content takes no span / col / flex / width.
 */
export declare function areas<const C extends Record<string, AreaContent>, const Id extends string = never>(template: string | readonly string[], cells: C, opts?: AreasOpts & {
    id?: Id;
}): AreasBand & Declares<Extract<keyof C, string> | IdsOf<C[keyof C]> | Id> & Refers<RefsOf<C[keyof C]>> & HandleOf<Id>;
