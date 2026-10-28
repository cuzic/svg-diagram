import type { IconGlyph } from './icon-store.ts';
import type { ColorKey, Rect, RevealOpts, ScopeOpts, Roles, WidthOf, LabelRole, WrapMode } from './types/core.ts';
export type ChartKind = 'waterfall' | 'radar' | 'heatmap' | 'stacked' | 'treemap' | 'sankey' | 'tornado' | 'bubble' | 'butterfly' | 'combo' | 'harvey' | 'catplot' | 'distplot' | 'multiplot' | 'regplot' | 'clustermap' | 'pert' | 'causal' | 'dependency';
export type ChartTone = 'accent' | 'danger' | 'muted' | 'text';
/** Options every chart has. */
export interface ChartOpts extends RevealOpts, ScopeOpts {
    /** A spotlight target and a connect() endpoint (the whole figure). The elements with an id of their own are anchors too. */
    id?: string;
    /** The text role of every label of the figure. Default 'note' (14px). */
    labelRole?: LabelRole;
    width?: number;
    height?: number;
    /** The text a screen reader / the <desc> gets instead of the one worked out from the data. */
    alt?: string;
}
/** The colour a label sits on, for the contrast check: a token colour at an opacity over the page. */
export interface ChartBg {
    fill: ColorKey;
    op?: number; /** The colour of the text (default: the page colour, as white on a dark bar). */
    ink?: ColorKey;
}
export type ChartItem = {
    k: 'rect';
    x: number;
    y: number;
    w: number;
    h: number;
    fill: ColorKey | 'none';
    op?: number;
    stroke?: ColorKey;
    sw?: number;
    dash?: string;
    of?: string | string[];
} | {
    k: 'path';
    d: string;
    fill: ColorKey | 'none';
    op?: number;
    stroke?: ColorKey;
    sw?: number;
    dash?: string;
    of?: string | string[];
    soft?: boolean;
} | {
    k: 'icon';
    name: string;
    glyph: IconGlyph;
    x: number;
    y: number;
    size: number;
    fill: ColorKey;
    of?: string;
} | {
    k: 'text';
    s: string;
    x: number;
    y: number;
    anchor: 'start' | 'middle' | 'end';
    fill: ColorKey;
    size: number;
    bold?: boolean;
    of?: string;
};
export interface ChartBox extends Rect {
    label: string;
    on?: ChartBg;
    host?: number;
    of?: string; /** Drawn on a plate of the page colour: lines behind it are covered, not crossed. */
    plate?: boolean;
}
export interface ChartSolid extends Rect {
    label: string;
    id?: string;
}
export interface ChartSeg {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}
export interface LaidOutChartPart {
    items: ChartItem[];
    boxes: ChartBox[];
    /** Rects that nothing else may overlap (bars, cells, nodes); a label may sit on one only when it is that label's own `host`. */
    solids: ChartSolid[];
    /** Lines a label must not be crossed by. */
    segs: ChartSeg[];
    anchors: {
        id: string;
        x: number;
        y: number;
        w: number;
        h: number;
    }[];
    /** The arrows of a network chart (pert, dependency, a causal loop that is not a ring), each from `from` to `to` as the polyline that was drawn (the placed points). Self-loops are not listed. The `edge-bends` check reads these. */
    edges?: {
        from: string;
        to: string;
        points: {
            x: number;
            y: number;
        }[];
    }[];
    /** What the figure leaves out of its drawing (labels too small for their cell): listed in the description instead. */
    omitted: string[];
    h: number;
}
/** What every chart's layout is given: the band's room, its text size and the measurer. */
/** `wrap`: the diagram's wrap mode (diagram({wrap})), for the labels Canvas.wrap breaks. */
export interface ChartGeom {
    x: number;
    y: number;
    w: number;
    height?: number;
    size: number;
    widthOf: WidthOf;
    wrap: WrapMode;
}
export declare const overlaps: (a: Rect, b: Rect) => boolean;
/** A number as it reads: exact (no float noise), thousands separated. */
export declare function numText(n: number): string;
/** A signed delta: +120 / -45 (0 is +0). */
export declare const signedText: (n: number) => string;
export declare const decimalsIn: (n: number) => number;
/** A value axis: the range widened to round ticks. */
export declare function niceScale(lo: number, hi: number, want?: number): {
    min: number;
    max: number;
    step: number;
    ticks: number[];
};
/** `domain: [lo, hi]` of a chart (its value axis's end points), checked: two finite numbers, lo < hi. */
export declare function checkDomain(who: string, domain: readonly [number, number] | undefined): [number, number] | undefined;
/** `plotInset: [left, right]` of a horizontal chart: how far the plot area starts from the chart's left edge and ends from its right edge (px). */
export declare function checkInset(who: string, inset: readonly [number, number] | undefined): [number, number] | undefined;
/** The plot's left and right margins: what the labels need, or the written `plotInset` when it leaves room for them (so that charts written with the same inset have the same plot area). */
export declare function insetOrNeed(who: string, inset: readonly [number, number] | undefined, needLeft: number, needRight: number): [number, number];
/** The value axis of a chart: from the data, or from its written `domain` (widened to round ticks like any axis). A domain smaller than the data is an error: the bars would leave the plot. */
export declare function valueScale(who: string, lo: number, hi: number, domain?: readonly [number, number]): ReturnType<typeof niceScale>;
/** Ticks thin enough for their labels: every k-th tick (counting from the one at zero, or the first) so that neighbours are `gap` apart. */
export declare function thinTicks<T extends {
    v: number;
}>(ticks: T[], px: (v: number) => number, size: (t: T) => number, gap?: number): Set<T>;
export interface Cand {
    x: number;
    y: number;
    anchor: 'start' | 'middle' | 'end';
}
export declare class Canvas {
    readonly items: ChartItem[];
    readonly boxes: ChartBox[];
    readonly solids: ChartSolid[];
    readonly segs: ChartSeg[];
    readonly anchors: {
        id: string;
        x: number;
        y: number;
        w: number;
        h: number;
    }[];
    readonly omitted: string[];
    /** The arrows drawn between two different nodes (semnet-common's arrow()), for LaidOutChartPart.edges. */
    readonly edges: {
        from: string;
        to: string;
        points: {
            x: number;
            y: number;
        }[];
    }[];
    /** Small marks (a line chart's markers) a label placed by place() keeps off; verify does not check them (two may share a spot). */
    readonly marks: Rect[];
    readonly x: number;
    readonly y: number;
    readonly w: number;
    h: number;
    readonly size: number;
    readonly widthOf: WidthOf;
    readonly mode: WrapMode;
    /** `mode`: the diagram's wrap mode, for wrap(). */
    constructor(x: number, y: number, w: number, h: number, size: number, widthOf: WidthOf, mode: WrapMode);
    tw(s: string, bold?: boolean): number;
    /** The box a label of this text occupies (the same box verify and the lint see). */
    boxOf(s: string, x: number, base: number, anchor: 'start' | 'middle' | 'end', bold?: boolean): Rect;
    /** The baseline that centres a line of text on `cy`. */
    mid(cy: number): number;
    rect(x: number, y: number, w: number, h: number, o: {
        fill: ColorKey | 'none';
        op?: number;
        stroke?: ColorKey;
        sw?: number;
        dash?: string;
        id?: string;
        of?: string;
        solid?: string;
    }): number;
    path(d: string, o: {
        fill: ColorKey | 'none';
        op?: number;
        stroke?: ColorKey;
        sw?: number;
        dash?: string;
        of?: string | string[];
        soft?: boolean;
    }): void;
    line(x1: number, y1: number, x2: number, y2: number, o: {
        stroke: ColorKey;
        sw?: number;
        dash?: string;
        of?: string;
        avoid?: boolean;
        soft?: boolean;
    }): void;
    /** An installed icon beside a label (decoration: the label says what it is). */
    icon(glyph: IconGlyph, name: string, x: number, y: number, size: number, fill: ColorKey, of?: string): void;
    /** Draws a label and registers its box. Coordinates are whole pixels, so the box is exactly what is drawn. */
    text(s: string, x: number, base: number, anchor: 'start' | 'middle' | 'end', fill: ColorKey, o?: {
        bold?: boolean;
        of?: string;
        on?: ChartBg;
        host?: number;
        plate?: boolean;
    }): ChartBox;
    /** Is there room for this box: inside the figure, off every other label, off every solid but its host, clear of the lines to avoid? */
    free(b: Rect, host?: number, margin?: number, plated?: boolean): boolean;
    /** Draws the label at the first candidate that is free; undefined (nothing drawn) when none is. */
    place(s: string, cands: Cand[], fill: ColorKey, o?: {
        bold?: boolean;
        of?: string;
        on?: ChartBg;
        host?: number;
        plate?: boolean;
    }): ChartBox | undefined;
    /** Wraps text into lines no wider than `maxW` (an atom wider than that stays on a line of its own). */
    wrap(s: string, maxW: number, bold?: boolean): string[];
    /** Several lines of one label, centred on x, the first line's baseline at `base`. */
    lines(ls: string[], x: number, base: number, anchor: 'start' | 'middle' | 'end', fill: ColorKey, o?: {
        bold?: boolean;
        of?: string;
        plate?: boolean;
    }): void;
    lineH(): number;
    done(): LaidOutChartPart;
}
/** The label size of a chart: its role's size. */
export declare const sizeOf: (labelRole: LabelRole | undefined, roles: Roles) => number;
/** An error with the chart's name in front. */
export declare const fail: (who: string, msg: string) => never;
export declare function finiteNum(who: string, what: string, v: unknown, o?: {
    min?: number;
}): number;
export declare function checkText(who: string, what: string, v: unknown): string;
export declare function checkIds(who: string, ids: (string | undefined)[], bandId: string | undefined): void;
/** Opacity of the accent for the n-th of `count` shades, light to dark (the ladder pyramid() uses, spread over `count` steps). */
export declare function shadeOps(count: number): number[];
/** The text colour that reads on the accent at this opacity. */
export declare const inkOnShade: (op: number) => ColorKey;
