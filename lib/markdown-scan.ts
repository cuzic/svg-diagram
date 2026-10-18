// Which lines of a Markdown text hold a diagram image, and where (ADR 0031 §3): the scanner of expandMarkdown() without the drawing.
// Pure: the fence / comment / list state of the lines does not depend on what a figure turns out to be, so the shell
// (lib/markdown.ts) draws the hits in document order and the order of its problems and notes stays the one they were found in.
const IMAGE = /!\[([^\]\n]*)\]\(\s*<?([^)\s>]+\.diagram\.ts(?:#(?:svg|html))?)>?(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/dg;

/** The same text with every inline code span's and one-line comment's characters blanked, so a match inside one can be told apart by offset. */
function maskCode(line: string): string {
  return line.replace(/(`+)(.+?)\1|<!--.*?-->/g, m => ' '.repeat(m.length));
}

export interface ScanHit {
  /** Offsets into `ln`. */
  index: number; end: number;
  /** The text of the hit as written, and whether a backslash escapes its `!` (`\\!` is escaped, `\\\\!` is not). */
  real: string; escaped: boolean;
  alt: string; target: string; title: string | undefined;
}
export interface ScanLine {
  /** Index into `lines`. */
  i: number;
  /** The line with and without its `\r`. */
  raw: string; ln: string;
  /** Inside a list item. */
  inList: boolean;
  hits: ScanHit[];
}

/** The lines of `text`, and for each line that has a diagram image (outside code, comments and escapes) its hits. */
export function scanFigures(text: string): {lines: string[]; found: ScanLine[]} {
  const lines = text.split('\n'), found: ScanLine[] = [];
  let fence: string | undefined;
  let comment = false;
  let inList = false;
  let afterBlock = false; // the previous line closed a block (a heading, a fence): an indented line after it is code
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const ln = raw.replace(/\r$/, '');
    // a fence opens and closes inside quotes and list items; outside them only with 0-3 spaces of indent, and a backtick fence's info has no backtick
    const m = /^([ \t>]*)(?:(?:[-*+]|\d+[.)])[ \t]+)?(`{3,}|~{3,})/.exec(ln);
    const nested = !!m && /[>\-*+\d]/.test(m[0].replace(m[2], '')) || inList;
    const isFence = !!m && (nested || m[1].replace(/\t/g, '    ').length < 4);
    if (fence) { if (isFence && m![2][0] === fence[0] && m![2].length >= fence.length && !ln.slice(m![0].length).trim()) { fence = undefined; afterBlock = true; } continue; }
    if (comment) { if (ln.includes('-->')) comment = false; continue; }
    if (isFence && !(m![2][0] === '`' && ln.slice(m![0].length).includes('`'))) { fence = m![2]; continue; }
    if (/^\s*(?:[-*+]|\d+[.)])[ \t]/.test(ln)) inList = true;
    else if (ln.trim() && !/^\s/.test(ln)) inList = false;
    const indented = /^( {4,}|\t)/.test(ln);
    const wasBlock = afterBlock;
    afterBlock = /^ {0,3}#{1,6}(\s|$)/.test(ln);
    if (indented && !inList && (i === 0 || !lines[i - 1].trim() || /^( {4,}|\t)/.test(lines[i - 1]) || wasBlock)) continue;
    let masked = maskCode(ln);
    const cut = masked.indexOf('<!--'); // a comment that opens here and ends on a later line
    if (cut >= 0) { comment = true; masked = masked.slice(0, cut); }
    const hits: ScanHit[] = [...masked.matchAll(IMAGE)].map(h => {
      const [a0, a1] = h.indices![1]!;
      return {index: h.index, end: h.index + h[0].length, real: ln.slice(h.index, h.index + h[0].length), escaped: (/\\*$/.exec(ln.slice(0, h.index))![0].length) % 2 === 1, alt: ln.slice(a0, a1), target: h[2], title: h[3] ?? h[4]};
    });
    if (hits.length) found.push({i, raw, ln, inList, hits});
  }
  return {lines, found};
}
