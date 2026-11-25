import type { LaidOutBpmn } from './types/diagrams.ts';
import type { LaidOutSwimlane } from './types/sequence-table-swimlane.ts';
import type { Finding } from './types/verdicts.ts';
/** Report text that broke into very short lines after fitting the diagram. */
export declare function narrowTextFindings(b: LaidOutBpmn | LaidOutSwimlane): Finding[];
export declare const shrinkRules: Readonly<{
    readonly 'shrink-narrow-text': {
        readonly doc: "fit: 'shrink' で bpmn / swimlane を詰めた結果、task / step の幅が狭すぎて本文が 2〜3 字ずつ折れる。縦向き・図の分割・文言の短縮を検討する";
        readonly scope: 'band';
    };
}>;
