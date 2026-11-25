import type { ToneEnv } from './tokens.ts';
/** The @media block (indented for a <style> whose rules are at 4 spaces), or '' when the figure uses no token colour. `tones`: the figure's tone overrides (their dark colours join the block). */
export declare function autoBlock(svgText: string, tones: ToneEnv): string;
/** The figure with its @media block taken out: the light side of an `auto` figure (the root still says data-appearance="auto"). */
export declare function stripAutoBlock(svg: string): string;
/** What marks a finding as the dark side's. */
export declare const DARK_NOTE = "\u6697\u3044\u914D\u8272";
export declare const isAuto: (svg: string) => boolean;
/**
 * The two SVG strings an `auto` figure is checked as (ADR 0023 D4). light: the figure with its @media block taken out. dark: the same with
 * every (attribute, colour) the block names replaced by the colour the block gives it, i.e. what a browser in the dark scheme paints, so the
 * checks need no media query. (Read from the block, not from the token table: a tone override's dark colour is in the block and not in the table.)
 */
export declare function autoSides(svg: string): {
    light: string;
    dark: string;
};
/** One figure drawn light and dark, as one list: what both sides say once; what only the dark side says, marked. */
export declare function mergeSides<T>(light: readonly T[], dark: readonly T[], key: (x: T) => string, mark: (x: T) => T): T[];
