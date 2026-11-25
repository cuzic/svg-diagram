import { PALETTE } from './tokens.js';
import { emojiSpan, escapeAttr, resolveBoxStyle, snap4 } from './emit-common.js';
export function frameGeometry(rect) {
    // Snap the right edge too, so adjacent frames with the same extent end at the same point.
    const x = snap4(rect.x);
    return { x, y: snap4(rect.y), w: snap4(rect.x + rect.w) - x, h: snap4(rect.h) };
}
export function renderBoxRect(band, day, tones, defaultTone) {
    const style = resolveBoxStyle(tones, band.tone ?? defaultTone, day, band.dashed);
    if (band.dim) {
        style.fill = PALETTE.bg;
        style.stroke = PALETTE.muted;
    }
    const dash = style.dashed ? ' stroke-dasharray="6,4"' : band.dim ? ' stroke-dasharray="2,5" stroke-linecap="round"' : '';
    const { x: rx, y: ry, w: rw, h: rh } = frameGeometry(band);
    return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2.5"${dash}${band.dataNode ? ` data-node="${escapeAttr(band.dataNode)}"` : ''}/>`;
}
// The stamp chip follows the bottom edge even when layout stretches the frame.
export function stampGeometry(band, stampW) {
    return { x: snap4(band.x + band.w - 8 - stampW), y: snap4(band.y + band.h - 6 - 24), w: snap4(stampW), h: 24 };
}
export function renderStamp(band, roles) {
    if (!band.stamp || band.stampW === undefined)
        return '';
    const { x, y, w, h } = stampGeometry(band, band.stampW);
    return `\n  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${PALETTE.bg}" stroke="${PALETTE.border}" stroke-width="1"/>\n  <text x="${snap4(band.x + band.w - 8 - band.stampW / 2)}" y="${y + 17}" font-size="${roles.note}" text-anchor="middle" fill="${PALETTE.muted}">${emojiSpan(band.stamp)}</text>`;
}
export function tagGeometry({ x, y, w, h }) {
    return { x: snap4(x), y: snap4(y), w: snap4(w), h };
}
