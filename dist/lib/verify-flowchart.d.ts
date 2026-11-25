import type { LaidOutStates } from './types/diagrams.ts';
import type { Finding } from './types/verdicts.ts';
export declare function flowchartFindings(b: LaidOutStates): Finding[];
export declare const flowchartRules: Readonly<{
    readonly 'flowchart-decision-edges': {
        readonly doc: '判断（flowchart のひし形）から出る矢印が 2 本未満、または 3 本以上、またはラベル（Yes / No など）がない';
        readonly scope: 'band';
    };
}>;
