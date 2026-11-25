import { badgeSvg, pillSvg } from './badge.js';
import { ringed, stepBadgeAt } from './box-step-geometry.js';
import { renderBoxRect, renderStamp, tagGeometry } from './emit-box-frame.js';
import { renderBoxText } from './emit-box-text.js';
import { emojiSpan, escapeXml, snap4 } from './emit-common.js';
import { iconSvg } from './icon-svg.js';
import { BOX_PAD_X, BOX_PAD_Y, ICON_SIZE, TOP_ICON_SIZE } from './layout-util.js';
import { must } from './must.js';
import { PALETTE, TAG_SIZE, colorOf, runColorOf, toneStyle } from './tokens.js';
export function renderStepBadge(band, day, roles) {
    const { cx, cy, r: R, size, baseline } = stepBadgeAt(band, roles);
    return badgeSvg({ cx, cy, r: R, w: 2 * R, shape: 'circle', label: String(band.step), aria: `${band.stepWord ?? '手順'} ${band.step}`, size, fill: PALETTE[day].accent, ...(ringed(band) ? { stroke: PALETTE.bg } : {}), baseline, snap: snap4, esc: escapeXml });
}
// box({icon}): the icon's path scaled from its source viewBox to ICON_SIZE, at the box's top-left. Its colour is a text tone
// (a dimmed box: muted). With a title the label carries the meaning, so the icon is hidden from assistive technology.
export function renderBoxIcon(band, day, tones) {
    const top = band.iconAt === 'top', size = top ? band.iconSize ?? TOP_ICON_SIZE : ICON_SIZE;
    const x = top ? band.x + band.w / 2 - size / 2 : band.x + (band.padX ?? BOX_PAD_X), y = band.y + (band.padY ?? BOX_PAD_Y);
    const color = band.dim ? PALETTE.muted : runColorOf(tones, band.iconTone, band.tone, day);
    return '\n  ' + iconSvg({ glyph: must(band.iconGlyph), name: must(band.icon), x, y, size, color, dim: band.dim, labelled: !!band.title });
}
export function renderTag(band, day, tones, roles) {
    const t = band.tagBox; // caller checked tagBox
    const fill = band.dim ? PALETTE.muted : colorOf(toneStyle(tones, band.tagTone === 'danger' || band.tagTone === 'muted' ? band.tagTone : 'accent').ink, day);
    return pillSvg({ ...tagGeometry(t), fill, cx: t.x + t.w / 2, baseline: t.y + 17, rawY: t.y, text: PALETTE.bg, ...(ringed(band) ? { stroke: PALETTE.bg } : {}), size: (roles.tag ?? TAG_SIZE), labelHtml: emojiSpan(band.tag) });
}
export function renderBox(band, day, tones, roles) {
    const badge = band.step != null ? `\n  ${renderStepBadge(band, day, roles)}` : '';
    const iconText = band.icon ? renderBoxIcon(band, day, tones) : '';
    const tag = band.tagBox ? `\n  ${renderTag(band, day, tones, roles)}` : '';
    const frame = band.frame === false ? '' : `${renderBoxRect(band, day, tones, 'plain')}\n  `;
    return `${frame}${renderBoxText(band, day, tones)}${badge}${iconText}${tag}${renderStamp(band, roles)}`;
}
export const boxSpotlight = { scopedId: true };
