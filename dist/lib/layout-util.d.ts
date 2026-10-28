import type { GroupBand, RowBand, GridBand } from './types/containers.ts';
import type { DiagramData, Roles, WidthOf, Rect } from './types/core.ts';
import type { CaptionBand } from './types/text-bands.ts';
export declare const LINE_HEIGHT_EM = 1.4;
export declare const BOX_PAD_X = 20;
export declare const BOX_PAD_Y = 16;
export declare const BOX_INNER_GAP = 8;
export declare const STEP_BADGE_R = 15;
export declare const STEP_BADGE_GAP = 10;
export declare const STEP_BADGE_BASELINE_OFFSET = 6;
export declare const STEP_INDENT: number;
export declare const ICON_SIZE = 32;
export declare const ICON_INDENT: number;
export declare const ICON_H = 32;
export declare const TOP_ICON_SIZE = 48;
export declare const TOP_ICON_GAP = 8;
export declare const topIcon: (band: {
    icon?: string;
    iconAt?: string;
}) => boolean;
/** What connect() joins to: the box — but for a node (icon above its text) the icon, so an arrow meets the picture, not its label. */
export declare function anchorRect(c: Rect & {
    type?: string;
    icon?: string;
    iconAt?: string;
    iconSize?: number;
    padY?: number;
}, h?: number): Rect;
export declare const TAG_H = 24;
export declare const TAG_PAD_X = 8;
/** The narrowest a canvas() region may be (px): below it a title breaks a character or two per line. */
export declare const CANVAS_MIN_REGION_W = 96;
export declare const STAMP_H = 24, STAMP_GAP = 6;
export declare const stampChipW: (widthOf: WidthOf, text: string, roles: Roles) => number;
export declare const LEGEND_SWATCH_W = 36, LEGEND_ITEM_GAP = 28, LEGEND_ROW_H = 24;
export declare function groupTitleBand(band: GroupBand): CaptionBand;
type SlotSizing = {
    span?: number;
    col?: number;
};
/** 1-based column and span of each row child on an N-column grid: `col` defaults to the column after the previous child. */
export declare function colSlots(children: SlotSizing[]): {
    col: number;
    span: number;
}[];
/** swimlane({fit: 'shrink'}) leaves the lane label / gap sizes alone while every column is at least this wide. */
export declare const SWIMLANE_COMFY_COL = 112;
/** The grid the emitter snaps box and group edges to (emit-boxes.ts snap4). */
export declare const GRID = 4;
declare const roundGrid: (n: number) => number;
/** The nearest 4px grid line: where a band / box top is placed (ADR 0014 D1, U1b), so the emitter's snap never moves it. */
export declare const snapGrid: typeof roundGrid;
export declare function gridColumns(contentWidth: number, n: number, gap: number, opts?: {
    fixedGap?: boolean;
    centerGutter?: boolean;
    anyGap?: boolean;
}): {
    x: number[];
    w: number[];
} | null;
export declare function rowChildGeometry(band: Pick<RowBand, 'cols' | 'gap' | 'justify' | 'itemWidth'> & {
    children: {
        span?: number;
        col?: number;
        flex?: number;
        width?: number;
        title?: string;
        id?: string;
    }[];
}, contentWidth: number): {
    widths: number[];
    xOffsets: number[];
};
export declare function gridChildGeometry(band: GridBand, contentWidth: number): {
    xs: number[];
    ws: number[];
};
/**
 * diagram({sourceLine}) is always the last band: left-aligned, muted, note size, whatever was add()ed and in whatever order.
 * Returns a copy (the input is not changed); without a sourceLine, the input itself.
 */
/** diagram({showTitle}) puts the title first, drawn like a group's title (bold, left, title size). A copy; without showTitle, the input itself. */
export declare function withTitleLine(d: DiagramData): DiagramData;
export declare function withSourceLine(d: DiagramData): DiagramData;
export {};
