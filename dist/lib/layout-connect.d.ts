import type { ScopeTable } from './anchor-scope.ts';
import type { ConnectBand, LaidOutConnect } from './types/containers.ts';
import type { ConnectRef, Rect, Roles, WidthOf } from './types/core.ts';
export declare function parseRef(ref: string): ConnectRef;
/**
 * A reference as written, with its id turned into the name the anchor is registered under (ADR 0012): a qualified name is itself,
 * a bare id that only one scoped item answers to is that item's qualified name, and one several answer to throws. Without scoped
 * items (the usual case) the reference comes back as it is.
 */
export declare function resolveRef(ref: string, anchors: ReadonlyMap<string, Rect>, scopes?: ScopeTable): ConnectRef;
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
/** A framed group's rectangle (and its id), as connect({via}) reads them off the laid-out bands. */
export type Frame = Rect & {
    id?: string;
};
export declare function resolveConnect(band: ConnectBand, anchors: Map<string, Rect>, areaIds: Set<string>, widthOf: WidthOf, roles: Roles, nodeBottoms?: Map<string, number>, scopes?: ScopeTable, frames?: readonly Frame[]): LaidOutConnect;
