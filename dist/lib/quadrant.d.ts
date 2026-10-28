import type { Anchor, Dimmed, FontFamily, Rect, RevealOpts, ScopeOpts, Roles, WidthOf, WrapMode } from './types/core.ts';
import type { BoxTone } from './types/text-bands.ts';
export type QuadrantPreset = 'bcg' | 'ge' | 'ansoff' | 'nineBox' | 'impactEffort' | 'risk' | 'stakeholder' | 'positioning' | 'eisenhower';
export declare const QUADRANT_PRESETS: readonly QuadrantPreset[];
/** An axis: its name, the words at its low / high end, and whether high is drawn first (left / bottom for a reversed y). */
export interface QuadrantAxis {
    title: string;
    /** The end where the values are low (e.g. '低'). */
    low?: string;
    high?: string;
    /** x: high on the left. y: high at the bottom. Item coordinates stay in value space (1 = high), whatever the direction. */
    reversed?: boolean;
}
export type QuadrantTone = BoxTone;
/** One cell: a caption (title, always text), a note under it and a tone. Written as `cells[row][col]`, rows from the top as drawn. */
export interface QuadrantCell {
    title?: string;
    note?: string;
    tone?: QuadrantTone;
}
export type QuadrantItemTone = 'accent' | 'text' | 'muted' | 'danger';
export interface QuadrantItem {
    /** An anchor for connect() / spotlight. */
    id?: string;
    label: string;
    /** The cell it belongs to, [col, row] counted from the top-left as drawn; laid out inside the cell without overlaps. */
    cell?: [col: number, row: number];
    /** Or its coordinates [x, y], 0..1, in value space (1 = high, whichever way the axis is drawn). */
    at?: [x: number, y: number];
    /** Bubble area is proportional to it. Items without one get the smallest bubble. */
    size?: number;
    tone?: QuadrantItemTone;
    /** Items of one group share a marker shape + colour and are listed in a legend. */
    group?: string;
}
/** An arrow end: an item id or a coordinate [x, y] (value space, 0..1). */
export type QuadrantEnd = string | [x: number, y: number];
/** A movement (portfolio shift): from → to. */
export interface QuadrantArrow {
    from: QuadrantEnd;
    to: QuadrantEnd;
    label?: string;
    dashed?: boolean;
}
/**
 * A region of the plot that is not a grid cell: a polygon in value space (each point [x, y], 0..1, 1 = high, whichever way the axis is drawn),
 * so a diagonal band (the flow channel between anxiety and boredom) can be drawn. It carries its own words; later regions are drawn over earlier ones.
 */
export interface QuadrantRegion {
    title: string;
    note?: string;
    tone?: QuadrantTone;
    /** At least 3 corners. */
    points: readonly (readonly [x: number, y: number])[];
    /** Where the caption is centred, [x, y] in value space (default: the middle of the polygon). */
    at?: readonly [x: number, y: number];
}
export interface QuadrantOpts extends RevealOpts, ScopeOpts {
    /** A spotlight target and a connect() endpoint (the whole figure); each item's id is an anchor too. */
    id?: string;
    /** Fills the axes, grid, captions and tones of a named framework; anything given here overrides it. */
    preset?: QuadrantPreset;
    x?: Partial<QuadrantAxis>;
    y?: Partial<QuadrantAxis>;
    /** [columns, rows]; default 2 x 2, or the shape of `cells`, or the preset's. */
    grid?: [cols: number, rows: number];
    cells?: (QuadrantCell | undefined)[][];
    items?: readonly QuadrantItem[];
    arrows?: readonly QuadrantArrow[];
    /** What the bubble area stands for ('売上'), and its unit ('億円'), for the size legend. */
    sizeTitle?: string;
    sizeUnit?: string;
    /** The order the groups are listed in the legend (default: first use). */
    groups?: readonly string[];
    /** No gaps between the cells: the cells read as one plot cut by a crosshair. */
    crosshair?: boolean;
    /** Free-shaped regions (diagonal bands) drawn over the cells. They need `crosshair: true` and cells without captions: the regions carry the words. */
    regions?: readonly QuadrantRegion[];
    /** Least height of the plot (px); the rows grow when the items need more room. */
    height?: number;
    width?: number;
    /** Cells [col, row] (from the top-left as drawn) that are empty on purpose, or true for all: quadrant-empty-cell does not report them. */
    allowEmpty?: true | readonly (readonly [col: number, row: number])[];
}
export interface QuadrantBand {
    type: 'quadrant';
    id?: string;
    reveal?: number;
    until?: number;
    x: QuadrantAxis;
    y: QuadrantAxis;
    cols: number;
    rows: number;
    /** [row][col], every slot filled. */
    cells: QuadrantCell[][];
    items: QuadrantItem[];
    arrows: QuadrantArrow[];
    sizeTitle?: string;
    sizeUnit?: string;
    groups: string[];
    crosshair: boolean;
    regions: QuadrantRegion[];
    height?: number;
    width?: number;
    allowEmpty?: true | [number, number][];
}
export type QuadrantShape = 'circle' | 'square' | 'diamond' | 'triangle';
export type QuadrantInk = 'text' | 'muted' | 'accent' | 'danger';
export interface QuadrantText {
    text: string;
    x: number;
    y: number;
    anchor: 'start' | 'middle' | 'end';
    size: number;
    bold: boolean;
    fill: QuadrantInk; /** index into bubbles: dims with its bubble */
    item?: number; /** ADR 0034: written as `data-node` (set by withNodeIds) */
    dataNode?: string;
}
export interface QuadrantBubble {
    x: number;
    y: number; /** area radius */
    r: number; /** the radius of the circle that holds the shape */
    cr: number;
    shape: QuadrantShape;
    tone: QuadrantInk;
    /** drawn as an outline (groups 5 to 8) */ hollow: boolean;
    /** index into cells: the cell the item belongs to (verify checks that it stays inside) */ cell: number;
    id?: string;
    label: string;
    dim?: boolean; /** ADR 0034: written as `data-node` on the marker (set by withNodeIds) */
    dataNode?: string;
}
export type QuadrantBoxKind = 'item' | 'arrow' | 'caption' | 'axis' | 'legend';
export interface LaidOutQuadrant extends Rect, Dimmed {
    type: 'quadrant';
    id?: string;
    reveal?: number;
    until?: number;
    plot: Rect;
    crosshair: boolean;
    cells: (Rect & {
        tone: QuadrantTone;
    })[];
    /** The free-shaped regions as pixel polygons, in drawing order (their captions are in `texts`). */
    regions: {
        points: [number, number][];
        tone: QuadrantTone;
    }[];
    /** The lines of a crosshair (the inner cell borders). */
    lines: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    }[];
    texts: QuadrantText[];
    bubbles: QuadrantBubble[];
    arrows: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        dashed: boolean;
        tip: {
            dx: number;
            dy: number;
        };
    }[];
    /** The backing of an arrow's label. */
    chips: Rect[];
    /** Markers of the legend (a group's shape, a reference bubble). */
    marks: {
        x: number;
        y: number;
        r: number;
        shape: QuadrantShape;
        tone: QuadrantInk;
        ring: boolean;
        hollow?: boolean;
    }[];
    anchors: Anchor[];
    /** Every text, as a rect: verify.ts reports two that overlap or one that leaves the figure. */
    labelBoxes: (Rect & {
        label: string;
        kind: QuadrantBoxKind; /** an item label: index into bubbles */
        item?: number;
    })[];
    /** Items that were moved off their coordinates to keep clear of others, with the distance (px). */
    moved: {
        id?: string;
        label: string;
        px: number;
    }[];
    /** Items whose size is so small that the bubble is drawn at the least radius (its area is then larger than the value says). */
    floored: string[];
    /** Cells that hold no item and are not listed in allowEmpty: "title [col, row]", 0-based from the top-left (as allowEmpty takes them). */
    emptyCells: string[];
}
/** Validates the options, applies the preset and returns the band. Every error names the item / option. */
export declare function quadrantBand(opts: QuadrantOpts): QuadrantBand;
/** The anchor ids of the band's items (read before layout, so reveal gives each the figure's stage). */
export declare const quadrantIds: (b: QuadrantBand) => string[];
/** Reference values for the size legend: the largest 1 / 2 / 5 x 10^k not above the biggest size, and a tenth of it. */
export declare function sizeRefs(max: number): number[];
/** Every [text, size, weight, font] the figure draws, so the measurer knows them before layout. */
export declare function quadrantTexts(b: QuadrantBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutQuadrant(band: QuadrantBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): LaidOutQuadrant;
