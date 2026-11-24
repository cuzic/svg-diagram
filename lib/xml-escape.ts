export const XML_ESC: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;'};

export function escapeXml(s: string): string {
  return s.replace(/[&<>]/g, (c: string) => XML_ESC[c] ?? c);
}

/** For a double-quoted attribute value: escapeXml, and the quote itself. */
export const escapeAttr = (s: string): string => escapeXml(s).replace(/"/g, '&quot;');
