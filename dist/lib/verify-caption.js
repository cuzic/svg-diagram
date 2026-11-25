import { at } from './finding-rules.js';
import { must } from './must.js';
/** A caption without an ink box has no background and its width is already wrap-constrained. */
export const captionRects = (band) => band.inkBox ? [{ id: null, label: `group title "${band.text}"`, ...band.inkBox }] : [];
// the width of a line in full-width characters (CJK, kana, hangul, fullwidth forms and pictographs count 1, everything else
// - Latin, digits, halfwidth katakana - 0.5)
const WIDE = [[0x1100, 0x115f], [0x2e80, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7af], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff01, 0xff60], [0xffe0, 0xffe6], [0x1f300, 0x1faff], [0x20000, 0x3fffd]];
export function fullWidthUnits(line) {
    let n = 0;
    for (const ch of line) {
        const c = must(ch.codePointAt(0));
        n += WIDE.some(([a, b]) => c >= a && c <= b) ? 1 : 0.5;
    }
    return n;
}
export function sourceLineFindings(b) {
    if (!b.sourceLine)
        return [];
    const lines = b.wrappedRuns.flatMap(r => r.lines), n = lines.length;
    if (n <= 1)
        return [];
    // Count the filled lines, excluding the last one, to estimate what fits.
    const filled = b.wrappedRuns.flatMap(r => r.lines.slice(0, -1));
    const fits = Math.floor(Math.max(0, ...filled.map(fullWidthUnits)));
    const total = Math.ceil(lines.reduce((s, l) => s + fullWidthUnits(l), 0));
    return [{ rule: 'source-wraps', severity: 'warn', message: `出典行が ${n} 行に折り返している（全角で約 ${total} 字分${fits > 0 ? `。1 行に入るのは約 ${fits} 字分なので、約 ${Math.max(1, fits - 1)} 字分以内に縮める` : ''}。半角の英数字は 0.5 字分）。出典の細部は本文へ` }];
}
export function duplicateTitleFindings(d, walk) {
    if (d.medium !== 'doc' || !d.title || d.showTitle)
        return [];
    const first = walk(d.bands).find((band) => band.type === 'caption' && !band.sourceLine);
    return first && !first.titleLine && first.text.trim() === d.title.trim()
        ? [{ ...at(first), rule: 'title-duplicated', severity: 'info', message: `題名と先頭の caption が同じ文字列「${first.text.trim().slice(0, 20)}」。diagram({title, showTitle: true}) に寄せて、caption を消せる` }]
        : [];
}
export const captionRules = /* @__PURE__ */ Object.freeze({
    'title-duplicated': { doc: '題名（diagram({title})）と、先頭の caption が同じ文字列。diagram({title, showTitle: true}) に寄せて、caption を消せる', scope: 'band' },
    'source-wraps': { doc: '出典行（diagram({sourceLine})）が 1 行に収まらず折り返している（短くする）', scope: 'diagram' },
});
