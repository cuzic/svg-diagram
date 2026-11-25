import type { Band, LaidOutDiagram } from './types/index.ts';
import type { DiagramData, Theme } from './types/core.ts';
import type { LaidOutBars } from './types/bars.ts';
import type { CheckRect, Finding } from './types/verdicts.ts';
export declare function barsProblems(band: LaidOutBars): string[];
export declare function barsRects(band: LaidOutBars): CheckRect[];
export declare function barsContrastProblems(band: LaidOutBars, theme: Theme, luminance: (hex: string) => number, dimFill?: boolean): string[];
/** Warn once, at the first band with a positive bar drawn at a pixel or less. */
export declare function thinBarFindings({ laidOut }: Partial<Pick<LaidOutDiagram, 'laidOut'>>): Finding[];
export declare function hiddenBarsTitleFindings(d: Pick<DiagramData, 'medium' | 'bands'>, title: () => string, walk: (bands: Band[]) => readonly Band[], stage?: number): Finding[];
export declare const barsRules: Readonly<{
    readonly 'bars-values-hidden': {
        readonly doc: '値ラベルも目盛りも出さない bars があるのに、図の題名（SVG の <title>）がなく、値を読み上げる <desc> が届かない（doc 媒体）';
        readonly scope: 'diagram';
    };
    readonly 'bars-thin-bar': {
        readonly doc: '棒が 1px 以下（値は 0 でない）。図の高さ・幅を上げるか max を見直す';
        readonly scope: 'band';
    };
}>;
