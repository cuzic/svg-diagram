import type { AreasBand, AreasOpts, ConnectBand, GridBand, GridOpts, GroupBand, RowBand, RowOpts, SpacerBand, GroupRowBand } from '../types/containers.ts';
import type { TextTone } from '../types/core.ts';
import type { Band } from '../types/index.ts';
import type { BoxBand, BoxTone } from '../types/text-bands.ts';
import type { Declares, IdsOf, HandleOf, Refers, RefsOf, RowHandleOf } from '../strict.ts';
import type { IconName } from '../icons.ts';
export declare function spacer(h: number, opts?: {
    reveal?: number;
}): SpacerBand;
export declare function row<C extends BoxBand, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>;
export declare function row<C extends BoxBand | GroupBand, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>;
export declare function row<C extends BoxBand | GroupBand | Exclude<Band, ConnectBand | SpacerBand | RowBand | GroupRowBand | GridBand | AreasBand>, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>;
/** One cell of iconRow(): the icon, the label beside it, and optionally a line of body. */
export interface IconRowItem {
    icon: IconName;
    label: string;
    body?: string;
    tone?: BoxTone;
    iconTone?: TextTone;
}
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
export declare function node<const Id extends string = never>(opts: NodeOpts & {
    id?: Id;
}): BoxBand & Declares<Id> & HandleOf<Id>;
/** A row of icon + label boxes (each a plain box({icon, title})). The label is required: an icon alone does not say what it means. */
export declare function iconRow(items: IconRowItem[], opts?: RowOpts): RowBand;
export declare function grid<C extends BoxBand>(children: C[], opts: GridOpts): GridBand & Declares<IdsOf<C>>;
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
