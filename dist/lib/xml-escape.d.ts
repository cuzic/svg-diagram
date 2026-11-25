export declare const XML_ESC: Record<string, string>;
export declare function escapeXml(s: string): string;
/** For a double-quoted attribute value: escapeXml, and the quote itself. */
export declare const escapeAttr: (s: string) => string;
