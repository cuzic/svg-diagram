import type { PartDef } from '../spec-kit.ts';
import type { TableColumn, TableOpts } from '../types/sequence-table-swimlane.ts';
export declare function defineMatrixPart<Result>(builder: (rows: never, cols: never, cells: never, opts: never) => Result, table: (columns: TableColumn[], rows: never, opts?: TableOpts) => Result): PartDef<Result>;
