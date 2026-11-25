import type { ToneEnv } from './tokens.ts';
import type { LaidOutTable, TableBand } from './types/sequence-table-swimlane.ts';
import type { Finding } from './types/verdicts.ts';
export declare const tableRules: Readonly<{
    readonly 'rowheader-tone-collides': {
        readonly doc: '表の行ラベル（rowHeader）と同じ塗り（soft）の行トーンがある';
        readonly scope: 'band';
    };
    readonly 'semantic-table-warning': {
        readonly doc: '意味付き表の入力に注意点がある（例: RACI の空の役割列）';
        readonly scope: 'band';
    };
    readonly 'table-sum-mismatch': {
        readonly doc: '表の「合計」行・列の値が、並ぶ値の和と合わない（丸めで説明できる差は除く）';
        readonly scope: 'band';
    };
    readonly 'table-share-not-100': {
        readonly doc: '表の「構成比」「割合」の列が、合計 100% にならない';
        readonly scope: 'band';
    };
}>;
export declare function semanticTableFindings(b: TableBand): Finding[];
export declare function rowHeaderFindings(b: LaidOutTable, tones: ToneEnv): Finding[];
