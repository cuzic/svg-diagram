import type { Focus, Rect, Roles, WidthOf, WrapMode } from './types/core.ts';
import type { FlowShapeBand, FlowText, FlowTextTone, LaidOutFlowShape } from './flow-types.ts';
export declare const BOX_TONES: ReadonlySet<string>;
export declare const TEXT_TONES: ReadonlySet<string>;
export declare function common(name: string, xs: readonly {
    label?: string;
    id?: string;
}[], id?: string): void;
/** focus on a sequence (ADR 0051): a copy of the items, the focused ones 'solid' and the rest 'muted' (by id or 1-based number). */
export declare function focusItems<T extends {
    id?: string;
    tone?: string;
}>(name: string, items: readonly T[], focus: Focus | undefined): T[];
/** The text tone on a filled (solid) item: white; otherwise the tone given. */
export declare const onItem: (tone: string | undefined, base: FlowTextTone) => FlowTextTone;
export declare function checkTones(name: string, xs: readonly {
    tone?: string;
}[], allowed: ReadonlySet<string>): void;
/** The advice for a figure too narrow for its band (ADR 0065): its own `width` when that is what holds it in, else the diagram's (the band's
 * plus the default margins, 20px each side). A spec has no width: spec.ts leaves this out (inSpecTerms). */
export declare const WIDEN: (b: {
    width?: number;
}, need: number) => string;
/** A 1-based number, or a label / id, as a 0-based index of `xs`. A name two of them answer to (one's label, another's id; or two with one
 * label) is refused: it would silently take the first. */
export declare function refIndex(name: string, what: string, ref: number | string, xs: readonly {
    label: string;
    id?: string;
}[]): number;
/** The item an item's frame names (ADR 0034): the id, when it has one. */
export declare const nodeOf: (item: {
    id?: string;
}) => {
    node?: string;
};
export type TextSpec = [text: string, size: number, weight: 400 | 700];
export type Pt = [number, number];
export declare const LINE = 1.35;
export declare const g4: (v: number) => number;
export declare function placeFlowShape<B extends FlowShapeBand>(b: B, x: number, y: number, cw: number, widthOf: WidthOf, roles: Roles, mode: WrapMode, draw: FlowLayout<B>): LaidOutFlowShape;
export type FlowLayout<B> = (b: B, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn, roles: Roles) => void;
/** `part`: the part the anchor is grouped in (ADR 0054), so a connector glued to it follows the item's group. */
export type AnchorFn = (id: string | undefined, r: Rect, part?: string) => void;
/** A wrapped text block: measure it first (lines, height), then place it. */
export declare class Texts {
    private out;
    readonly widthOf: WidthOf;
    private roles;
    private mode;
    constructor(out: LaidOutFlowShape, widthOf: WidthOf, roles: Roles, mode: WrapMode);
    wrap(text: string, maxW: number, weight?: 400 | 700, size?: number): {
        text: string;
        lines: string[];
        h: number;
        w: number;
        size: number;
        weight: 400 | 700;
    };
    width(text: string, weight?: 400 | 700, size?: number): number;
    /** The height of one line of note text. */
    lineH(): number;
    /** Places a wrapped block with its top at `top`; `x` is its centre (middle), left edge (start) or right edge (end). */
    /** `xAt`: a line's own x for the height its middle is at (a slanted shape whose room moves sideways with the height), else `x` for every line. */
    place(block: ReturnType<Texts['wrap']>, x0: number, top: number, tone?: FlowTextTone, anchor?: FlowText['anchor'], part?: string, xAt?: (y: number) => number): void;
}
