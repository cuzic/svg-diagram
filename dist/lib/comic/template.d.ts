export type TemplatePart = {
    lit: string;
} | {
    slot: string;
};
export declare const COMIC_ID: RegExp;
/** Splits a template into literals and blanks. Throws on a brace that is neither a blank nor an escaped brace. */
export declare function parseTemplate(tpl: string, who?: string): TemplatePart[];
/** The text of a template with every blank replaced by `fill(id)`. */
export declare const fillTemplate: (parts: readonly TemplatePart[], fill: (id: string) => string) => string;
export declare const slotIdsOf: (parts: readonly TemplatePart[]) => string[];
