import type { ConnectRef, Rect, Roles, WidthOf } from './types/core.ts';
export declare function parseRef(ref: string): ConnectRef;
/** The width of a connect's label text (the chip, if any, is 16px wider). */
export declare const connectLabelWidth: (label: string, roles: Roles, widthOf: WidthOf) => number;
/**
 * The rectangle a connect's label takes, its text baseline at (labelX, labelY): the text itself, or, for a chip, the 24px-high pill 16px
 * wider than the text (then `labelBox` is the chip too). One formula for the layout and for labelRoom() (lib/connect-rules.ts, ADR 0069 D1).
 */
export declare function labelRects(labelWidth: number, roles: Roles, chip: boolean, labelX?: number, labelY?: number): {
    labelBox: Rect;
    chipBox?: Rect;
};
