export const XML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
export function escapeXml(s) {
    return s.replace(/[&<>]/g, (c) => XML_ESC[c] ?? c);
}
/** For a double-quoted attribute value: escapeXml, and the quote itself. */
export const escapeAttr = (s) => escapeXml(s).replace(/"/g, '&quot;');
