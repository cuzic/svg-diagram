import type { LaidOutFlowShape } from './flow-shapes.ts';
import type { Finding } from './types/verdicts.ts';
/** ADR 0065: a mark of a concentric with sectors whose label found no spot clear of the ring and sector lines. */
export declare function concentricFindings(b: LaidOutFlowShape): Finding[];
export declare const concentricRules: Readonly<{
    readonly 'concentric-label-crossing': {
        readonly doc: 'concentric の扇形（sectors）の印の見出しが、輪の線か区切り線（layout: stack では段や列の線）をまたぐ、または stack の外枠の外に出る（重ならない場所が見つからなかった。ADR 0065）';
        readonly scope: 'band';
    };
}>;
