import type { TextRequest, WidthOf, Roles, WrapMode } from './types/core.ts';
import type { TableBand, TableCell, TableColumn, ResolvedCell, LaidOutTable } from './types/sequence-table-swimlane.ts';
export declare function tableTexts(band: TableBand, roles: Roles): TextRequest[];
export declare const TBL: {
    padX: number;
    padY: number;
    padYDense: number;
    iconSize: number;
    iconGap: number;
};
export declare function cellOf(cell: TableCell, col?: TableColumn): ResolvedCell;
export declare function layoutTable(band: TableBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): LaidOutTable;
