export declare const FONT = 18;
export declare const LINE_H = 26;
export declare const PAD_X = 12;
export declare const PAD_Y = 10;
/** The inner width of a bubble: nine full-width characters. */
export declare const INNER_MAX = 162;
/** The most full-width characters a blank may take (a product limit: a blank always fits on one line). */
export declare const SLOT_MAX = 9;
export declare const SLOT_FONT = 14;
export declare const HEAD_R = 36;
/** The head's centre is this far above the bottom of its panel (the body is cut by the frame). */
export declare const HEAD_FROM_BOTTOM = 76;
export declare const STAGE_X = 104;
export declare const PANEL_W = 420;
export declare const PANEL_W_2X2 = 360;
export declare const GUTTER = 16;
export declare const MARGIN = 16;
export declare const bandWidth: (cols: number, panelWidth: number) => number;
export declare const BADGE = 24;
export declare const BADGE_OVERHANG = 8;
export declare const FRAME = 3;
/** The bubbles start this far below the top of a panel and keep this far from the sides. */
export declare const ZONE_TOP = 16;
export declare const SIDE_KEEP = 8;
/** A narration starts this far from the side (the number badge reaches 16px in, and 2px are left clear). */
export declare const NARRATION_LEFT = 20;
export declare const STACK_GAP = 6;
export declare const HEAD_KEEP = 4;
/** The tail tip stops this far outside the head circle. */
export declare const TAIL_STOP = 6;
export declare const TAIL_MIN = 10;
/** The tail tip never comes closer than this to the head circle, whatever TAIL_MIN says. */
export declare const TAIL_CLEAR = 1;
export declare const TAIL_HALF = 8;
export declare const TAIL_TOLERANCE = 0.17;
/**
 * The comic keeps its paper and ink whatever the diagram's appearance (ADR 0074 D6: it is for print and export). The colours are the light
 * tokens, written as rgb() so that the dark recolouring (a hex-for-hex map, lib/tokens.ts recolor) does not touch them.
 */
export declare const rgb: (hex: string) => string;
export declare const COLOR: {
    readonly ink: string;
    readonly prompt: string;
    readonly filled: string;
    readonly paper: string;
    readonly warm: string;
    readonly cool: string;
    readonly bubble: string;
    readonly skin: string;
};
export declare const f1: (n: number) => number;
