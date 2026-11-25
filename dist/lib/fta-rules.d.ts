import type { FtaBand } from './types/diagrams.ts';
export type FtaRule = 'fta-gate-one-input' | 'fta-vote-degenerate' | 'fta-top-is-leaf' | 'fta-undeveloped-left' | 'fta-single-point';
export interface FtaFinding {
    rule: FtaRule;
    message: string; /** Fixed: reported at this severity whatever diagram({rcaCheck}) says. */
    severity?: 'info';
}
export declare function ftaFindings(band: Pick<FtaBand, 'root' | 'id'>): FtaFinding[];
export declare const ftaRules: Readonly<{
    readonly 'fta-gate-one-input': {
        readonly doc: '故障の木(faultTree)の AND / OR / vote ゲートの入力が 1 つだけ。ゲートが意味を持たない。diagram({rcaCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'fta-vote-degenerate': {
        readonly doc: '故障の木の vote ゲートの k が 1(OR と同じ)または入力の数(AND と同じ)。diagram({rcaCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'fta-top-is-leaf': {
        readonly doc: '故障の木の頂上事象にゲートが無い(1 つの事象だけの木)。diagram({rcaCheck: "strict"}) で warn';
        readonly scope: 'band';
    };
    readonly 'fta-undeveloped-left': {
        readonly doc: '故障の木に、展開していない事象(ひし形)が残っている(常に info。意図した省略なら無視してよい)';
        readonly scope: 'band';
    };
    readonly 'fta-single-point': {
        readonly doc: '故障の木に、単独で頂上事象を起こす事象(大きさ 1 のカットセット)がある。カットセットが多すぎて調べられないときもこの規則の info(常に info)';
        readonly scope: 'band';
    };
}>;
