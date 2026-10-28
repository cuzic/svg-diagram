export interface Sheet {
    svg: string;
    width: number;
    height: number;
}
/** `figures`: [file name (for the caption), SVG text]. Throws, naming the file, for one without a width/height or viewBox. */
export declare function buildSheet(figures: [string, string][], { cols, width }?: {
    cols?: number;
    width?: number;
}): Sheet;
/** Splits `items` into pages of `perPage` (the last may be short), or into exactly `pages` pages (at most one per item)
 *  whose sizes differ by at most one, the larger first; neither given: one page. */
export declare function paginate<T>(items: T[], { perPage, pages }?: {
    perPage?: number;
    pages?: number;
}): T[][];
/** `sheet.png` -> `sheet-1.png`, `sheet-2.png`, ... (1-based); a single page keeps the name as given. */
export declare function pageName(out: string, index: number, total: number): string;
