export interface MidWordBreak {
    before: string;
    after: string; /** The whole word the break cut (its run of katakana or of Latin letters across the break, as far as the two lines show it) */
    word: string;
}
/** The word breaks of one wrapped run. With the run's source text, a break where the text has a space or a newline is the author's own; without it only katakana is judged. */
export declare function midWordBreaks(lines: readonly string[], text?: string): MidWordBreak[];
/** Every mid-word break in a laid-out tree: a `wrappedRuns` entry (lines + source text) or any plain `lines: string[]`. */
export declare function midWordBreaksIn(root: unknown, source?: string): MidWordBreak[];
/** The pictographs in the text of a laid-out tree that would be drawn with the text font (and may come out blank). */
export declare function missingGlyphs(root: unknown): string[];
/** All the strings of the author's bands (labels, titles, bodies ...), for checking what was written without a space. */
export declare function sourceText(bands: unknown): string;
