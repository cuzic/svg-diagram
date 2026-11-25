import type { LaidOutDiagram } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
export declare function parallelEdgeFindings(d: Partial<Pick<LaidOutDiagram, 'laidOut' | 'density' | 'canvas' | 'layoutCheck'>>): Finding[];
export declare const causeSpacingRules: Readonly<{
    readonly 'edge-parallel': {
        readonly doc: 'causeTree() の図で、別の矢印どうしの同じ向きの線が、レーンの間隔（14px、density: "compact" で 11px。canvas の図は文字の倍率 `max(1, minText の倍率)` を掛けた値、minText: 18 で 18px）より近くで 4px を超えて並び、その長さの合計がレーンの間隔の 2 倍を超える（端を共有する矢印どうしも数える。たどれない平行線の束になる）。pdpc・relationDiagram・whyWhyTree は対象外。既定は情報、diagram({layoutCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
}>;
