import type { Finding } from './types/verdicts.ts';
import type { LaidOutQuadrant, QuadrantBand } from './quadrant.ts';
export declare function quadrantProblems(band: LaidOutQuadrant): string[];
export declare function quadrantFindings(b: QuadrantBand): Finding[];
export declare function quadrantLayoutFindings(b: LaidOutQuadrant): Finding[];
export declare const quadrantRules: Readonly<{
    readonly 'quadrant-item-moved': {
        readonly doc: 'quadrant() の項目が、重なりを避けるため指定した座標から 16px 以上動いた（座標は目安として読まれる）';
        readonly scope: 'band';
    };
    readonly 'quadrant-size-floor': {
        readonly doc: 'quadrant() の項目の size が小さすぎ、最小の円で描いた（面積が値より大きく見える）';
        readonly scope: 'band';
    };
    readonly 'quadrant-empty-cell': {
        readonly doc: 'quadrant() のマスに項目が 1 つもない（「該当なし」の空の枠が残っている。意図した空きは allowEmpty で示す）';
        readonly scope: 'band';
    };
    readonly 'quadrant-tone-only': {
        readonly doc: 'quadrant() の項目の色（tone）だけで種類を分けている（group を使うと形と凡例でも伝わる）';
        readonly scope: 'band';
    };
}>;
