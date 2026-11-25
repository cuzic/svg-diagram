import type { LaidOutCause } from './types/diagrams.ts';
import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
export declare function causeBandsOf(bands: readonly LaidOutBand[], out?: LaidOutCause[]): LaidOutCause[];
export declare function densityRestorationFindings(d: Partial<Pick<LaidOutDiagram, 'laidOut'>>): Finding[];
export declare const densityRules: Readonly<{
    readonly 'cause-line-scale-dropped': {
        readonly doc: "canvas の causeTree で、線の間隔を文字の倍率で広げた図が canvas の高さ・幅に収まらず、広げない間隔で描いた（情報）。canvas を高くする・minText を下げる・図を分けると広げられる";
        readonly scope: 'band-grouped';
    };
    readonly 'density-compact-restored': {
        readonly doc: "diagram({density: 'compact'}) の因果ツリー・状態遷移で、詰めた図のほうが検査の問題(箱を通る矢印・ラベルの重なり)が多いので、通常の間隔で描いた（情報）";
        readonly scope: 'band-grouped';
    };
}>;
