import { sourceOf, withSource } from './source-ref.js';
/** diagram({showTitle}) puts the title first, drawn like a group's title (bold, left, title size). A copy; without showTitle, the input itself. */
export function withTitleLine(d) {
    return !d.showTitle || !d.title ? d : { ...d, bands: [withSource({ type: 'caption', text: d.title, align: 'left', role: 'title', tone: 'text', bold: true, mono: false, titleLine: true }, sourceOf(d)), ...d.bands] };
}
/**
 * diagram({sourceLine}) is always the last band: left-aligned, muted, note size, whatever was add()ed and in whatever order.
 * Returns a copy (the input is not changed); without a sourceLine, the input itself.
 */
export function withSourceLine(d) {
    return d.sourceLine === undefined ? d : { ...d, bands: [...d.bands, withSource({ type: 'caption', text: d.sourceLine, align: 'left', role: 'note', tone: 'muted', bold: false, mono: false, sourceLine: true }, sourceOf(d))] };
}
