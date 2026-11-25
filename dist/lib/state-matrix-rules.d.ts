import type { Finding } from './types/verdicts.ts';
import type { ScreensBand } from './types/wireframe.ts';
export declare function stateMatrixFindings(b: ScreensBand): Finding[];
export declare const stateMatrixRules: Readonly<{
    readonly 'wf-states-todo': {
        readonly doc: '状態の一覧に「未設計」の欄がある（設計するか、対象外と明示する）';
        readonly scope: 'band';
    };
    readonly 'wf-states-required': {
        readonly doc: '状態の一覧に、必須の状態の列がない';
        readonly scope: 'band';
    };
    readonly 'wf-states-ragged': {
        readonly doc: '状態の一覧の行に、列より多い欄がある';
        readonly scope: 'band';
    };
}>;
