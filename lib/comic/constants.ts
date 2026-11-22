import {PALETTE} from '../tokens.ts';

// The fixed numbers of comic() (ADR 0074 D1 / D2). Every coordinate is on the 4px grid, or comes from a measure that is rounded to it.
export const FONT = 18;
export const LINE_H = 26;
export const PAD_X = 12;
export const PAD_Y = 10;
/** The inner width of a bubble: nine full-width characters. */
export const INNER_MAX = 162;
/** The most full-width characters a blank may take (a product limit: a blank always fits on one line). */
export const SLOT_MAX = 9;
export const SLOT_FONT = 14;
export const HEAD_R = 36;
/** The head's centre is this far above the bottom of its panel (the body is cut by the frame). */
export const HEAD_FROM_BOTTOM = 76;
export const STAGE_X = 104;
export const PANEL_W = 420;
export const PANEL_W_2X2 = 360;
export const GUTTER = 16;
export const MARGIN = 16;
export const BADGE = 24;
export const FRAME = 3;
/** The bubbles start this far below the top of a panel and keep this far from the sides. */
export const ZONE_TOP = 16;
export const SIDE_KEEP = 8;
/** A narration starts this far from the side (the number badge reaches 16px in, and 2px are left clear). */
export const NARRATION_LEFT = 20;
export const STACK_GAP = 6;
export const HEAD_KEEP = 4;
/** The tail tip stops this far outside the head circle. */
export const TAIL_STOP = 6;
export const TAIL_MIN = 10;
/** The tail tip never comes closer than this to the head circle, whatever TAIL_MIN says. */
export const TAIL_CLEAR = 1;
export const TAIL_HALF = 8;
export const TAIL_TOLERANCE = 0.17;
/**
 * The comic keeps its paper and ink whatever the diagram's appearance (ADR 0074 D6: it is for print and export). The colours are the light
 * tokens, written as rgb() so that the dark recolouring (a hex-for-hex map, lib/tokens.ts recolor) does not touch them.
 */
const rgb = (hex: string): string => `rgb(${[1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(',')})`;
export const COLOR = {ink: rgb(PALETTE.text), prompt: rgb(PALETTE.muted), filled: rgb(PALETTE.danger), paper: rgb(PALETTE.bg), warm: rgb(PALETTE.amber.soft), cool: rgb(PALETTE.blue.soft), bubble: rgb(PALETTE.bg), skin: rgb(PALETTE.amber.soft)} as const;
export const f1 = (n: number): number => Math.round(n * 10) / 10;
