// diagram({status: 'draft'}): a strip across the top of the figure with a badge at its right end (ADR 0022 D5-D7).
// A band of its own (not a caption): a caption would be a candidate for the figure's title, a spotlight subject and a layout-* ruler.
import { textWidth } from './atoms.js';
/** The wording of the badge when `statusLabel` is not given. */
export const DEFAULT_STATUS_LABEL = '下書き';
const PAD_X = 10, PAD_Y = 5, STRIP_PAD = 2;
/** The wording the badge shows. */
export const statusText = (d) => d.statusLabel ?? DEFAULT_STATUS_LABEL;
/** The same figure with the status strip as its first band (the input is not changed); without a status, the input itself. */
export function withStatus(d) {
    if (d.status === undefined)
        return d;
    const band = { type: 'status', status: d.status, text: statusText(d) };
    return { ...d, bands: [band, ...d.bands] };
}
/** Every text this band draws, for measuring: [text, size, weight, font]. */
export function statusTexts(band, roles) {
    return [[band.text, roles.note, 700, 'sans']];
}
export function layoutStatus(band, x, y, w, widthOf, roles) {
    const size = roles.note;
    const pillH = size + 2 * PAD_Y, pillW = Math.ceil(textWidth(widthOf, band.text, size, 700)) + 2 * PAD_X;
    if (pillW > w)
        throw new Error(`diagram({status}): the badge "${band.text}" needs ${pillW}px but the figure is ${Math.round(w)}px wide (shorten statusLabel)`);
    const h = pillH + 2 * STRIP_PAD;
    const pill = { x: x + w - pillW, y: y + STRIP_PAD, w: pillW, h: pillH };
    return { ...band, x, y, w, h, pill, size, textY: pill.y + pillH / 2 + size * 0.36 };
}
