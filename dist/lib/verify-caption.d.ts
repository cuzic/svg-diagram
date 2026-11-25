import type { DiagramData } from './types/core.ts';
import type { Band } from './types/index.ts';
import type { LaidOutCaption } from './types/text-bands.ts';
import type { CheckRect, Finding } from './types/verdicts.ts';
/** A caption without an ink box has no background and its width is already wrap-constrained. */
export declare const captionRects: (band: LaidOutCaption) => CheckRect[];
export declare function fullWidthUnits(line: string): number;
export declare function sourceLineFindings(b: LaidOutCaption): Finding[];
export declare function duplicateTitleFindings(d: Pick<DiagramData, 'medium' | 'title' | 'showTitle' | 'bands'>, walk: (bands: Band[]) => readonly Band[]): Finding[];
export declare const captionRules: Readonly<{
    readonly 'title-duplicated': {
        readonly doc: '題名（diagram({title})）と、先頭の caption が同じ文字列。diagram({title, showTitle: true}) に寄せて、caption を消せる';
        readonly scope: 'band';
    };
    readonly 'source-wraps': {
        readonly doc: '出典行（diagram({sourceLine})）が 1 行に収まらず折り返している（短くする）';
        readonly scope: 'diagram';
    };
}>;
