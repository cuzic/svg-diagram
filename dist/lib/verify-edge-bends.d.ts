import type { LaidOutDiagram } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
export declare const EDGE_BENDS_MAX = 5, EDGE_BENDS_MEAN = 3;
export declare function edgeBendFindings(d: Partial<Pick<LaidOutDiagram, 'laidOut' | 'layoutCheck'>>): Finding[];
export declare const edgeBendRules: Readonly<{
    readonly 'edge-bends': {
        readonly doc: '自動配置の図（cause / states / bpmn / classes / semnet）で、1 本の矢印が 5 回以上折れる、または折れの合計 ÷ 矢印の数が 3 を超える。既定は情報、diagram({layoutCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
}>;
