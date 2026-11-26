// The fixed numbers of chat() (ADR 0074 D7). The text sizes, paddings and the line height are comic()'s (lib/comic/constants.ts), so one blank is the same size in both.
/** The band's width: 480px by default; `chat(sheet, {width})` takes 480 to 880 in steps of 4. */
export const CHAT_W = 480;
export const CHAT_W_MAX = 880;
export const CHAT_MARGIN = 16;
export const AVATAR_D = 40;
export const AVATAR_GAP = 8;
/**
 * The widths that follow from the band's width. The column is the width a bubble may take, from its edge: the content width less the avatar's side (both sides keep it,
 * so a right bubble is as wide as a left one). The inner width a bubble wraps at is 70% of the column (D7), or the widest blank with its bound hiragana when that is wider.
 */
export function chatDims(width: number): {w: number; column: number; inner: number} {
  const column = width - 2 * CHAT_MARGIN - AVATAR_D - AVATAR_GAP;
  return {w: width, column, inner: Math.floor(column * 7 / 10)};
}
export const NAME_H = 20;
export const NAME_FONT = 14;
export const GAP_SAME = 4;
export const GAP_RUN = 12;
export const GAP_SEPARATOR = 24;
export const TAIL_W = 8;
export const BUBBLE_R = 14;
export const INPUT_H = 48;
export const INPUT_GAP = 16;
export const INPUT_FONT = 16;
export const SEND_R = 12;
