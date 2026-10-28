import type { TextRequest, WidthOf, Roles, WrapMode } from './types/core.ts';
import type { SequenceBand, PreparedSequence, TableBand, TableCell, TableColumn, ResolvedCell, LaidOutSequence, LaidOutTable } from './types/sequence-table-swimlane.ts';
export declare const lineH: (size: number) => number;
export declare const SEQ_ICON = 20, SEQ_ICON_H: number;
export declare const SEQ: {
    headPadY: number;
    headPadX: number;
    stepGap: number;
    labelGap: number;
    selfW: number;
    noteH: number;
    dividerH: number;
};
export declare function prepareSequence(band: SequenceBand): PreparedSequence;
export declare function collectTextRequests(band: SequenceBand | TableBand, roles: Roles): TextRequest[];
export declare function layoutSequence(band: SequenceBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): LaidOutSequence;
export declare const TBL: {
    padX: number;
    padY: number;
    padYDense: number;
    iconSize: number;
    iconGap: number;
};
export declare function cellOf(cell: TableCell, col?: TableColumn): ResolvedCell;
export declare function layoutTable(band: TableBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): LaidOutTable;
