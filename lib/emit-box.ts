import {badgeSvg, pillSvg} from './badge.ts';
import {renderBoxRect, renderStamp, tagGeometry} from './emit-box-frame.ts';
import {renderBoxText} from './emit-box-text.ts';
import {emojiSpan, escapeXml, snap4} from './emit-common.ts';
import {iconSvg} from './icon-svg.ts';
import {BOX_PAD_X, BOX_PAD_Y, ICON_INDENT, ICON_SIZE, STEP_BADGE_BASELINE_OFFSET, STEP_BADGE_R, STEP_INDENT, TOP_ICON_SIZE, stepBadgeGeom} from './layout-util.ts';
import {must} from './must.ts';
import {PALETTE, TAG_SIZE, colorOf, isSolidTone, runColorOf, toneStyle} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Rect, Roles, Theme} from './types/core.ts';
import type {LaidOutBox} from './types/text-bands.ts';

// Numbered circle badge for box({step}) — solid accent fill, white number,
// centered on the title's own baseline (same offset every hand-authored
// "① foo" box in this deck used between the badge and its number glyph).
// On a solid box the badge / tag pill has the box's own fill, so a white ring keeps it apart from the box.
export const ringed = (band: Pick<LaidOutBox, 'dim' | 'tone'>): boolean => !band.dim && isSolidTone(band.tone);


/** Where a box's step badge is: its centre and radius, the number's size and baseline (the title's own). The svg and the PPTX place it alike. */
export function stepBadgeAt(band: Pick<LaidOutBox, 'x' | 'y' | 'w' | 'wrappedRuns' | 'padX' | 'padY' | 'align' | 'iconAt' | 'titleW' | 'icon'>, roles?: Roles): {cx: number; cy: number; r: number; size: number; baseline: number} {
  const g = roles ? stepBadgeGeom(roles) : {r: STEP_BADGE_R, offset: STEP_BADGE_BASELINE_OFFSET, indent: STEP_INDENT, size: 16}, R = g.r; // a canvas diagram grows the badge with its text
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

export function renderStepBadge(band: LaidOutBox, day: Theme, roles?: Roles): string {
  const {cx, cy, r: R, size, baseline} = stepBadgeAt(band, roles);
  return badgeSvg({cx, cy, r: R, w: 2 * R, shape: 'circle', label: String(band.step), aria: `${band.stepWord ?? '手順'} ${band.step}`, size, fill: PALETTE[day].accent, ...(ringed(band) ? {stroke: PALETTE.bg} : {}), baseline, snap: snap4, esc: escapeXml});
}


// box({icon}): the icon's path scaled from its source viewBox to ICON_SIZE, at the box's top-left. Its colour is a text tone
// (a dimmed box: muted). With a title the label carries the meaning, so the icon is hidden from assistive technology.
export function renderBoxIcon(band: LaidOutBox, day: Theme, tones: ToneEnv): string {
  const top = band.iconAt === 'top', size = top ? band.iconSize ?? TOP_ICON_SIZE : ICON_SIZE;
  const x = top ? band.x + band.w / 2 - size / 2 : band.x + (band.padX ?? BOX_PAD_X), y = band.y + (band.padY ?? BOX_PAD_Y);
  const color = band.dim ? PALETTE.muted : runColorOf(tones, band.iconTone, band.tone, day);
  return '\n  ' + iconSvg({glyph: must(band.iconGlyph), name: must(band.icon), x, y, size, color, dim: band.dim, labelled: !!band.title});
}

export function renderTag(band: LaidOutBox, day: Theme, tones: ToneEnv, roles: Roles): string {
  const t = band.tagBox as Rect; // caller checked tagBox
  const fill = band.dim ? PALETTE.muted : colorOf(toneStyle(tones, band.tagTone === 'danger' || band.tagTone === 'muted' ? band.tagTone : 'accent').ink, day);
  return pillSvg({...tagGeometry(t), fill, cx: t.x + t.w / 2, baseline: t.y + 17, rawY: t.y, text: PALETTE.bg, ...(ringed(band) ? {stroke: PALETTE.bg} : {}), size: (roles.tag ?? TAG_SIZE), labelHtml: emojiSpan(band.tag as string)});
}

export function renderBox(band: LaidOutBox, day: Theme, tones: ToneEnv, roles: Roles): string {
  const badge = band.step != null ? `\n  ${renderStepBadge(band, day, roles)}` : '';
  const iconText = band.icon ? renderBoxIcon(band, day, tones) : '';
  const tag = band.tagBox ? `\n  ${renderTag(band, day, tones, roles)}` : '';
  const frame = band.frame === false ? '' : `${renderBoxRect(band, day, tones, 'plain')}\n  `;
  return `${frame}${renderBoxText(band, day, tones)}${badge}${iconText}${tag}${renderStamp(band, roles)}`;
}
