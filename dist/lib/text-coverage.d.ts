import { type Cell, type Uncovered } from './covers.ts';
export interface TextCoverage {
    /** old labels with words / numbers the new picture does not carry */
    missing: Uncovered[];
    /** new labels with words / numbers the old picture did not carry */
    added: Uncovered[];
    oldCount: number;
    newCount: number;
}
/** One cell per <text> that has any visible characters, in document order (`line` is its 1-based position). */
export declare function textCells(svg: string): Cell[];
export declare function textCoverage(oldSvg: string, newSvg: string): TextCoverage;
/** The report as lines of text. `withAdded: false` leaves out what only the new picture has. */
export declare function formatTextCoverage(r: TextCoverage, withAdded?: boolean): string[];
