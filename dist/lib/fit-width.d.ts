import type { FitApplied } from './types/diagrams.ts';
import type { LayeredLayout } from './graph-layout.ts';
export interface FitResult {
    size: {
        w: number;
        h: number;
    };
    score: {
        crossings: number;
        bends: number;
    };
}
export interface FitAttempt<R extends FitResult> {
    /** How the failure message names it, e.g. `dir 'up' (as written)`, `maxNodeW 130`. */
    label: string;
    run: () => R;
    /** What the attempt changed from the author's figure (recorded when it is the one chosen). The first attempt, as written, has none. */
    applied?: FitApplied[];
}
export interface FitOpts<R extends FitResult> {
    /** first: the first attempt that fits (a figure that already fits is never touched). best: of the attempts that fit (and are not too tall), the best score; a tie goes to the earlier one. */
    mode: 'first' | 'best';
    /** The tallest a figure may be (a canvas height or the slide's `maxDisplayHeight`; both modes skip an attempt taller than it). None: width only. */
    heightBudget?: number;
    /** The width an attempt takes up when that is not `size.w` (a state diagram's loops hang out beside it). */
    widthOf?: (r: R) => number;
}
/** `fitsWidth`: the unrounded width fit (`w` is rounded up, so it cannot tell an attempt 0.3px over from one that fit). */
export interface Tried {
    label: string;
    w: number;
    h: number;
    fitsWidth?: boolean;
}
export type Fitted<R extends FitResult> = {
    ok: true;
    result: R;
    index: number; /** what the chosen attempt changed */
    applied: FitApplied[];
    tried: Tried[];
} | {
    ok: false;
    tried: Tried[]; /** every attempt's result, in the order of `tried` */
    results: R[];
};
/**
 * Runs the attempts in order. `first` stops at the first that fits `w` (the rest are not run); `best` runs them all and keeps the best of
 * those that fit `w` and the height budget. Every attempt that ran is in `tried`, with its width and height, whether or not it was chosen.
 */
export declare function fitWidth<R extends FitResult>(w: number, attempts: readonly FitAttempt<R>[], opts: FitOpts<R>): Fitted<R>;
/**
 * The message for a figure no attempt fitted: what was tried with its width, what was not tried and why, and one fix.
 *   causeTree(): the figure does not fit 900px.
 *     tried: dir 'up' (as written) 1460px; dir 'right' 1180px
 *     not tried: dir 'right' (dir is explicit; write dir: 'auto' to let it change)
 *     fix: dir: 'auto', or widen the figure (diagram({width: 1100}))
 */
export declare function fitFailure(who: string, w: number, tried: readonly Tried[], fix: string, notTried?: readonly string[], heightBudget?: number, split?: string): string;
/** A width to suggest in a fix: the narrowest tried figure, rounded up to the next 20px and plus the margins the caller gives. */
export declare function widerThan(tried: readonly Tried[], margins?: number): number;
/** One phrase for the `auto-fit-applied` rule: what changed and what it did to the width. */
export declare function describeApplied(a: FitApplied): string;
/** What an attempt changed, with the widths filled in: the figure as first tried (`tried[0]`) against the one chosen. */
export declare function withWidths(applied: readonly FitApplied[], tried: readonly Tried[], index: number): FitApplied[];
/** The widths a node may grow to, widest first, when a figure has to be narrowed to fit (ADR 0010 D1). Below the last the text breaks into one or two characters a line. */
export declare const NARROWING: number[];
/** `maxNodeW: 'auto'` (ADR 0019 D2): widest first, 10px apart. The first that fits the width and the height budget is kept: fewer lines in a node, a shorter figure. */
export declare const AUTO_GRID: number[];
export interface LayoutPlan<D extends string, R extends FitResult> {
    /** `causeTree()`, `stateDiagram()`: the start of the failure message. */
    who: string;
    /** The width the figure has. */
    w: number;
    /** The direction as laid out when nothing changes (the written one, or the default). */
    start: D;
    /** diagram({keepWords}) (ADR 0029 D3): every attempt is tried with the katakana floor first, then without; `build` gets which as `floor`. */
    keepWords: boolean;
    /** The other axis, tried when the author left `dir` out or wrote 'auto'. None: the axis is kept (a cause tree). */
    alt?: D;
    /** Said when `alt` is none: why. */
    axisKept?: string;
    /** `dir` is written as a direction: nothing is changed. */
    explicitDir: boolean;
    /** How `dir` was not written: left out (a warning) or 'auto' (a note). */
    mode: 'omitted' | 'auto';
    /** The component can fold a layer into rows (ADR 0010 D7; `build` takes the row limit as its fourth argument). Only a figure whose layers lie across its width. */
    foldable?: boolean;
    /** The author's `fold`: true allows folding also when `dir` is written, false forbids it. */
    fold?: boolean;
    /** A written maxNodeW is not narrowed. */
    maxNodeW?: number;
    /** `maxNodeW: 'auto'` (ADR 0019 D2): the widest node width that fits the width (and the height budget) is looked for, from AUTO_GRID, also when `dir` is written; folding is the last resort. */
    autoWidth?: boolean;
    /** false: the component has no node width to narrow (a class diagram). */
    narrow?: boolean;
    /** true: the figure has no `dir` (a mindmap): the labels leave it out. */
    noDir?: boolean;
    /** One attempt. `floor`: whether this attempt keeps katakana words whole (always false when the diagram did not ask for keepWords). */
    build: (dir: D, maxW: number, floor: boolean, fold?: number) => R;
    widthOf?: (r: R) => number;
    heightBudget?: number;
    /** The layout of a result (a layered figure's `lay`, whose layers lie along the height when `vertical`): the failure message then says where to split the figure. */
    layoutOf?: (r: R) => {
        lay: LayeredLayout;
        vertical: boolean;
    };
    /** 'best' (dir: 'auto' with an axis to choose): the best score; otherwise the first that fits. */
    best?: boolean;
    /** More lines for "not tried". */
    notTried?: string[];
    /** The one fix to name when the figure is not given as an explicit dir; default: a wider figure, or splitting it when that is a lot wider. */
    fix?: string;
}
/**
 * Lays a figure out in the ways ADR 0010 D1 allows and returns the first (or best) that fits `w`, with what was changed to get there.
 * Throws, with what was tried and one fix, when none fits. A figure that fits as written is attempt 0 and changes nothing.
 */
export declare function fitLayout<D extends string, R extends FitResult>(plan: LayoutPlan<D, R>): {
    result: R;
    applied: FitApplied[];
};
