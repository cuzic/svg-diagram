import { textColorOf } from './tokens.ts';
import type { ToneEnv } from './tokens.ts';
import type { Point, Theme, EmphasisTone, LineStyle, Arrow, Align } from './types/core.ts';
import type { WrappedRun, Span } from './types/text-bands.ts';
export declare const EMOJI_G: RegExp;
export declare function snap4(n: number): number;
export declare const XML_ESC: Record<string, string>;
export declare function escapeXml(s: string): string;
/** For a double-quoted attribute value: escapeXml, and the quote itself. */
export declare const escapeAttr: (s: string) => string;
export declare function emojiSpan(text: string): string;
export declare const resolveTextColor: typeof textColorOf;
export interface BoxStyle {
    fill: string;
    stroke: string;
    dashed: boolean;
}
export declare function resolveBoxStyle(tones: ToneEnv, tone: EmphasisTone | undefined, day: Theme, dashedOverride?: boolean): BoxStyle;
export declare const resolveLineColor: typeof textColorOf;
export declare function spanTspans(spans: Span[], run: WrappedRun, color: string, day: Theme, tones: ToneEnv, dim?: boolean): string;
export declare function renderTextRuns(wrappedRuns: WrappedRun[], { originX, originY, w, align, day, tones, dim, boxTone }: {
    originX: number;
    originY: number;
    w: number;
    align: Align;
    day: Theme;
    tones: ToneEnv;
    dim?: boolean;
    boxTone?: EmphasisTone;
}): string;
export declare function lineAttrs(line: LineStyle | undefined): string;
export declare function arrowMarkers(arrow: Arrow | undefined, dim?: boolean, strong?: boolean): string;
export declare function trimEnds(a: number, b: number, arrow: Arrow | undefined): [number, number];
export declare function trimPoints(points: Point[], arrow: Arrow): Point[];
/** A hop over another line: a bump of height `r` toward `side`, at a point on one of the runs (ADR 0028). */
export interface PathCut {
    x: number;
    y: number;
    side: {
        x: number;
        y: number;
    };
    r: number;
}
export declare function arrowPath(points: {
    x: number;
    y: number;
}[], color: string, line: LineStyle | undefined, width?: number, headAt?: 'end' | 'both', end?: 'arrow' | 'bar', cuts?: readonly PathCut[]): string;
export declare const LH_EM = 1.4;
export declare function strokeLine(d: string, color: string, line: LineStyle | undefined, arrow: Arrow | undefined, width?: number): string;
export declare function textLines(lines: string[], { x, top, size, weight, anchor, fill, mono }: {
    x: number;
    top: number;
    size: number;
    weight?: number;
    anchor?: 'start' | 'middle' | 'end';
    fill: string;
    mono?: boolean;
}): string;
export declare function rrPath(x: number, y: number, w: number, h: number, { tl, tr, br, bl }?: {
    tl?: number;
    tr?: number;
    br?: number;
    bl?: number;
}): string;
