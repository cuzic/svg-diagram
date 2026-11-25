export const px = (n) => `${+n.toFixed(2)}px`;
export function htmlAdapterFor(adapters, band) {
    // The lookup key couples each renderer's input type to the current band.
    const adapter = adapters[band.type];
    return adapter?.type === band.type ? adapter : undefined;
}
// like SVG text, runs of white space are one space (XML white space only: U+3000 and NBSP are characters, not white space)
const collapse = (s) => s.replace(/[ \t\r\n]+/g, ' ');
export const escapeHtmlText = (s) => collapse(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
