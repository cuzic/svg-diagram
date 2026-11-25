import type { TableBand, TableCellSpec, TableColumn, TableOpts, TableRow } from '../types/sequence-table-swimlane.ts';
import type { Declares, HandleOf } from '../strict.ts';
export declare function table<const Id extends string = never>(columns: TableColumn[], rows: readonly TableRow[], opts?: TableOpts & {
    id?: Id;
}): TableBand & Declares<Id> & HandleOf<Id>;
export declare function cell(text: string | number, opts?: Omit<TableCellSpec, 'text'>): TableCellSpec;
