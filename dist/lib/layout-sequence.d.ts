import type { TextRequest, WidthOf, Roles, WrapMode } from './types/core.ts';
import type { SequenceBand, PreparedSequence, LaidOutSequence } from './types/sequence-table-swimlane.ts';
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
export declare function sequenceTexts(band: SequenceBand, roles: Roles): TextRequest[];
export declare function layoutSequence(band: SequenceBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): LaidOutSequence;
