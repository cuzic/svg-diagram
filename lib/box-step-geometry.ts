import {BOX_PAD_X, BOX_PAD_Y, ICON_INDENT, STEP_BADGE_BASELINE_OFFSET, STEP_BADGE_R, STEP_INDENT, stepBadgeGeom} from './layout-util.ts';
import {must} from './must.ts';
import {isSolidTone} from './tokens.ts';
import type {Roles} from './types/core.ts';
import type {LaidOutBox} from './types/text-bands.ts';

// Numbered circle badge for box({step}) — solid accent fill, white number,
// centered on the title's own baseline (same offset every hand-authored
// "① foo" box in this deck used between the badge and its number glyph).
// On a solid box the badge / tag pill has the box's own fill, so a white ring keeps it apart from the box.
export const ringed = (band: Pick<LaidOutBox, 'dim' | 'tone'>): boolean => !band.dim && isSolidTone(band.tone);


/** Where a box's step badge is: its centre and radius, the number's size and baseline (the title's own). The svg and the PPTX place it alike. */
export function stepBadgeAt(band: Pick<LaidOutBox, 'x' | 'y' | 'w' | 'wrappedRuns' | 'padX' | 'padY' | 'align' | 'iconAt' | 'titleW' | 'icon' | 'stepAbove'>, roles?: Roles): {cx: number; cy: number; r: number; size: number; baseline: number} {
  const g = roles ? stepBadgeGeom(roles) : {r: STEP_BADGE_R, offset: STEP_BADGE_BASELINE_OFFSET, indent: STEP_INDENT, size: 16}, R = g.r; // a canvas diagram grows the badge with its text
  if (band.stepAbove) { // the badge on its own line above the title: at the box's top, on the title's alignment; the number sits where it sits in a badge beside a title
    const top = band.y + (band.padY ?? BOX_PAD_Y), x0 = band.x + (band.padX ?? BOX_PAD_X), x1 = band.x + band.w - (band.padX ?? BOX_PAD_X), al = band.align ?? 'left';
    return {cx: al === 'center' ? (x0 + x1) / 2 : al === 'right' ? x1 - R : x0 + R, cy: top + R, r: R, size: g.size, baseline: top + R + g.offset};
  }
  const titleRun = must(band.wrappedRuns[0]);
  // the same padding the text and the icon use (a swimlane step has its own)
  const px = band.padX ?? BOX_PAD_X, titleBaselineY = band.y + (band.padY ?? BOX_PAD_Y) + must(titleRun.lineYs[0]);
  // a centred / right-aligned title: the badge goes just before its first line (titleW, from layout); else at the left edge, after a left icon
  const indent = titleRun.indent ?? 0, left = band.x + px + indent, right = band.x + band.w - px;
  const align = band.align ?? (band.iconAt === 'top' ? 'center' : 'left');
  const textX = band.titleW === undefined || align === 'left' ? undefined : align === 'center' ? (left + right) / 2 - band.titleW / 2 : right - band.titleW;
  const cx = textX !== undefined ? textX - g.indent + R : band.x + px + R + (band.icon && band.iconAt !== 'top' ? ICON_INDENT : 0);
  return {cx, cy: titleBaselineY - g.offset, r: R, size: g.size, baseline: titleBaselineY};
}
