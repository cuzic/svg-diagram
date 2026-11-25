import type { Finding } from './types/verdicts.ts';
import type { LaidOutWireframe, WireframeBand } from './types/wireframe.ts';
export declare const wireframeCalloutRules: Readonly<{
    readonly 'wf-callout-no-note': {
        readonly doc: '図の番号に対応する注釈がない';
        readonly scope: 'band';
    };
    readonly 'wf-note-no-callout': {
        readonly doc: '注釈に対応する番号が図にない';
        readonly scope: 'band';
    };
    readonly 'wf-callout-gap': {
        readonly doc: '図の番号が 1 からの連番になっていない';
        readonly scope: 'band';
    };
    readonly 'wf-callout-duplicate': {
        readonly doc: '同じ番号が複数の場所に付いている（情報）';
        readonly scope: 'band';
    };
    readonly 'wf-callout-order': {
        readonly doc: '図の番号が、読む順（上から下、左から右）に並んでいない（情報）';
        readonly scope: 'band';
    };
}>;
export declare function calloutOrderFindings(b: LaidOutWireframe): Finding[];
export declare function calloutNoteFindings(b: WireframeBand): Finding[];
export declare const wireframeCalloutVerification: {
    findings: typeof calloutNoteFindings;
    layoutFindings: typeof calloutOrderFindings;
    acceptHint: (rule: string) => string | undefined;
};
