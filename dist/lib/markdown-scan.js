// Which lines of a Markdown text hold a diagram image, and where (ADR 0031 §3): the scanner of expandMarkdown() without the drawing.
// Pure: the fence / comment / list state of the lines does not depend on what a figure turns out to be, so the shell
// (lib/markdown.ts) draws the hits in document order and the order of its problems and notes stays the one they were found in.
const IMAGE = /!\[([^\]\n]*)\]\(\s*<?([^)\s>]+\.diagram\.ts(?:#(?:svg|html))?)>?(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/dg;
/** The same text with every inline code span's and one-line comment's characters blanked, so a match inside one can be told apart by offset. */
function maskCode(line) {
    return line.replace(/(`+)(.+?)\1|<!--.*?-->/g, m => ' '.repeat(m.length));
}
/** The lines of `text`, and for each line that has a diagram image (outside code, comments and escapes) its hits. */
export function scanFigures(text) {
    const lines = text.split('\n'), found = [];
    let fence;
    let comment = false;
    let inList = false;
    let afterBlock = false; // the previous line closed a block (a heading, a fence): an indented line after it is code
    for (const [i, raw] of lines.entries()) {
        const ln = raw.replace(/\r$/, '');
        // a fence opens and closes inside quotes and list items; outside them only with 0-3 spaces of indent, and a backtick fence's info has no backtick
        const m = /^([ \t>]*)(?:(?:[-*+]|\d+[.)])[ \t]+)?(`{3,}|~{3,})/.exec(ln);
        const open = m?.[0] ?? '', mark = m?.[2];
        const nested = mark !== undefined && /[>\-*+\d]/.test(open.replace(mark, '')) || inList;
        const isFence = mark !== undefined && (nested || (m?.[1] ?? '').replace(/\t/g, '    ').length < 4);
        if (fence) {
            if (isFence && mark[0] === fence[0] && mark.length >= fence.length && !ln.slice(open.length).trim()) {
                fence = undefined;
                afterBlock = true;
            }
            continue;
        }
        if (comment) {
            if (ln.includes('-->'))
                comment = false;
            continue;
        }
        if (isFence && !(mark[0] === '`' && ln.slice(open.length).includes('`'))) {
            fence = mark;
            continue;
        }
        if (/^\s*(?:[-*+]|\d+[.)])[ \t]/.test(ln))
            inList = true;
        else if (ln.trim() && !/^\s/.test(ln))
            inList = false;
        const indented = /^( {4,}|\t)/.test(ln);
        const wasBlock = afterBlock;
        afterBlock = /^ {0,3}#{1,6}(\s|$)/.test(ln);
        if (indented && !inList && (i === 0 || !(lines[i - 1] ?? '').trim() || /^( {4,}|\t)/.test(lines[i - 1] ?? '') || wasBlock))
            continue;
        let masked = maskCode(ln);
        const cut = masked.indexOf('<!--'); // a comment that opens here and ends on a later line
        if (cut >= 0) {
            comment = true;
            masked = masked.slice(0, cut);
        }
        const hits = [...masked.matchAll(IMAGE)].flatMap(h => {
            const alt = h.indices?.[1], target = h[2];
            if (!alt || target === undefined)
                return [];
            return [{ index: h.index, end: h.index + h[0].length, real: ln.slice(h.index, h.index + h[0].length), escaped: ((/\\*$/.exec(ln.slice(0, h.index)) ?? [''])[0].length) % 2 === 1, alt: ln.slice(alt[0], alt[1]), target, title: h[3] ?? h[4] }];
        });
        if (hits.length)
            found.push({ i, raw, ln, inList, hits });
    }
    return { lines, found };
}
