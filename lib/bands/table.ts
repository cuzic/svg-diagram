import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {table as build} from '../dsl/sequence-table-swimlane.ts';
import {renderTable} from '../emit-tables.ts';
import {snapGrid} from '../layout-util.ts';
import {layoutTable, tableTexts} from '../seq-table.ts';
import type {LaidOutTable, TableBand, TableColumn, TableOpts, TableRow} from '../types/sequence-table-swimlane.ts';

export {cell} from '../dsl/sequence-table-swimlane.ts';

export const tableDefinition: BandDef<TableBand, LaidOutTable> = {
  type: 'table',
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of tableTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap}) {
    const laid = layoutTable(data, x, snapGrid(y), w, widthOf, roles, wrap);
    return {laid, h: laid.h};
  },
  emit: (laid, {theme, tones, roles}) => renderTable(laid, theme, tones, roles),
  svgDefs: laid => ({mono: laid.rows.some(row => row.cells.some(cell => cell.mono && cell.lines.length))}),
};

export function table<const Id extends string = never>(columns: TableColumn[], rows: readonly TableRow[], opts?: TableOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutTable> {
  const data = build<Id>(columns, rows, opts);
  return band<typeof data, LaidOutTable>(tableDefinition, data);
}
