import type { SequenceBand, PreparedSequence, TableBand, TableCell, TableColumn, ResolvedCell, TextRequest, WidthOf, LaidOutSequence, LaidOutTable } from './types.ts';
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
export declare function collectTextRequests(band: SequenceBand | TableBand): TextRequest[];
export declare function layoutSequence(band: SequenceBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutSequence;
export declare const TBL: {
    padX: number;
    padY: number;
};
export declare function cellOf(cell: TableCell, col?: TableColumn): ResolvedCell;
export declare function layoutTable(band: TableBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutTable;
