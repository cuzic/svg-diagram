import type { LaidOutBand } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
export declare const layoutFitRules: Readonly<{
    readonly 'auto-fit-applied': {
        readonly doc: '幅に収まらないので、dir / maxNodeW を省略した図(causeTree・stateDiagram・flowchart・classDiagram・tree)をレイアウトが自動で変えた（dir を省略: warn、dir: \'auto\': info）。明示した dir / maxNodeW は変えず、収まらなければ試した案つきで throw する';
        readonly scope: 'band';
    };
}>;
export declare function layoutFitFindings(b: LaidOutBand): Finding[];
export declare const layoutFitVerification: {
    layoutFindings: typeof layoutFitFindings;
    acceptHint: (rule: string) => string | undefined;
};
