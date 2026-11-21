import type { FontWeight, Roles, TextTone, WidthOf, WrapMode } from './types/core.ts';
import type { Band } from './types/index.ts';
import type { Span, TextRun, WrappedRun } from './types/text-bands.ts';
/** `run` with the pieces of its text attached, when it has any (a plain run stays exactly as it was). */
export declare function withSpans(run: TextRun, spans: Span[] | undefined): TextRun;
type TextRunsOf<B> = (band: B, roles: Roles) => TextRun[];
export declare const TEXT_RUNS: {
    caption: TextRunsOf<import("./types/text-bands.ts").CaptionBand>;
    banner: TextRunsOf<import("./types/text-bands.ts").BannerBand>;
    box: TextRunsOf<import("./types/text-bands.ts").BoxBand>;
};
/** The text runs of a band's own text (none for a type that is not in TEXT_RUNS). */
export declare function textRuns(band: Band, roles: Roles): TextRun[];
/** An atom of a run's text with the weight (and tone) it is drawn in; `glue`: it continues the atom before it (see wrapStyledAtoms). */
export interface StyledAtom {
    text: string;
    weight: FontWeight;
    tone?: TextTone;
    glue?: boolean;
}
/**
 * The atoms of a run, each with its own weight: the ONE place a run is cut up for measuring, wrapping and the width of a line,
 * so what is registered is what is looked up. The plain text is cut as ever (splitAtoms); an atom that a span boundary falls
 * inside ('API' | 's') is cut there into pieces, each continuing the one before it, so it is measured per piece but never
 * broken between lines.
 */
export declare function styledAtoms(run: TextRun): StyledAtom[];
/** Width of line `i` of a wrapped run: its atoms' widths added (the pieces of a line with spans, each in its own weight). */
export declare function lineWidth(widthOf: WidthOf, run: WrappedRun, i: number): number;
export declare function layoutBoxContent(band: Band, wrapWidth: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): {
    wrappedRuns: WrappedRun[];
    textHeight: number;
};
export {};
