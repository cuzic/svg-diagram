export interface ScanHit {
    /** Offsets into `ln`. */
    index: number;
    end: number;
    /** The text of the hit as written, and whether a backslash escapes its `!` (`\\!` is escaped, `\\\\!` is not). */
    real: string;
    escaped: boolean;
    alt: string;
    target: string;
    title: string | undefined;
}
export interface ScanLine {
    /** Index into `lines`. */
    i: number;
    /** The line with and without its `\r`. */
    raw: string;
    ln: string;
    /** Inside a list item. */
    inList: boolean;
    hits: ScanHit[];
}
/** The lines of `text`, and for each line that has a diagram image (outside code, comments and escapes) its hits. */
export declare function scanFigures(text: string): {
    lines: string[];
    found: ScanLine[];
};
