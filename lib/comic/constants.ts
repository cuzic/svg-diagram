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
/** The band width a row layout (2x1 / 3x1 / 4x1) is sized for when the width is not known: the content width of canvas: 'slide' (1280 less its padding). The panels share the width the diagram gives the band. */
export const ROW_FALLBACK_W = 1212;
/** The narrowest a row panel is drawn: two heads (stage x at least HEAD_R + 4, 4px apart) and a one-line bubble fit in it. */
export const ROW_PANEL_MIN = 200;
/** Left, centre and right heads keep apart in a row panel this wide or wider (stage x of 40 at the narrowest: 2 x 40 + 2 x 72 + 2 x 4). */
export const ROW_CENTER_MIN = 232;
/** The people of a row panel keep their heads this far from each other (and at least HEAD_R + 4 from the side). */
export const HEAD_GAP = 4;
export const GUTTER = 16;
export const MARGIN = 16;
export const bandWidth = (cols: number, panelWidth: number): number => 2 * MARGIN + cols * panelWidth + (cols - 1) * GUTTER;
export const BADGE = 24;
export const BADGE_OVERHANG = 8;
export const FRAME = 3;
/** The bubbles keep this far from the sides of a panel (they start below the badge: `zoneTop` of the metrics; a narration starts right of it: `narrationLeft`). */
export const SIDE_KEEP = 8;
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
export const rgb = (hex: string): string => `rgb(${[1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(',')})`;
export const COLOR = {ink: rgb(PALETTE.text), prompt: rgb(PALETTE.muted), filled: rgb(PALETTE.danger), paper: rgb(PALETTE.bg), warm: rgb(PALETTE.amber.soft), cool: rgb(PALETTE.blue.soft), bubble: rgb(PALETTE.bg), skin: rgb(PALETTE.amber.soft)} as const;
export const f1 = (n: number): number => Math.round(n * 10) / 10;

/** The dialogue text size range a comic accepts (px). */
export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 28;
/** The sizes that follow the dialogue text size `font`: everything is the default's, scaled by font / 18 (the default's own numbers are kept as they are). */
/** `badge` is the number badge's side, `badgeText` its text size and `badgeBase` the text's baseline from the badge top; `zoneTop` and `narrationLeft` keep the bubbles clear of it. */
export interface ComicMetrics {font: number; lineH: number; padX: number; padY: number; inner: number; slotFont: number; baseline: number; badge: number; badgeText: number; badgeBase: number; zoneTop: number; narrationLeft: number}
export const metricsOf = (font: number = FONT): ComicMetrics => {
  const k = font / FONT;
  return {font, lineH: Math.round(LINE_H * k), padX: Math.round(PAD_X * k), padY: Math.round(PAD_Y * k), inner: SLOT_MAX * font, slotFont: Math.round(SLOT_FONT * k), baseline: Math.round(19 * k),
    badge: Math.round(BADGE * k), badgeText: Math.round(SLOT_FONT * k), badgeBase: Math.round(17 * k), zoneTop: Math.round(BADGE * k) - BADGE_OVERHANG, narrationLeft: Math.round(BADGE * k) - BADGE_OVERHANG + 4};
};
