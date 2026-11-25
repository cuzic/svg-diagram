import { PALETTE } from './tokens.js';
import { pillSvg } from './badge.js';
import { snap4, escapeAttr, emojiSpan } from './emit-common.js';
/**
 * The status badge (diagram({status})): one accessible unit, a dashed outline (not colour alone says "draft"), bold text. Colours are
 * tokens, so appearance: 'dark' recolours it like everything else; `danger` is not used (it means "an example not to follow").
 */
export function renderStatus(band) {
    const p = band.pill;
    const pill = pillSvg({ x: snap4(p.x), y: snap4(p.y), w: snap4(p.w), h: p.h, fill: PALETTE.bg, stroke: PALETTE.muted, sw: 1.5, dash: '4 3', cx: p.x + p.w / 2, baseline: band.textY, rawY: p.y, text: PALETTE.text, size: band.size, labelHtml: emojiSpan(band.text) });
    return `<g role="img" aria-label="${escapeAttr(band.text)}" data-status="${band.status}">\n  ${pill}\n  </g>`;
}
export const statusSpotlight = {
    // The status badge is furniture.
    dim() { },
};
