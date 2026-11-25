import type { ToneEnv } from './tokens.ts';
import type { LaidOutDiagram } from './types/index.ts';
import type { CheckRect, Issue, Verdict } from './types/verdicts.ts';
interface FigureCheck {
    issues: Issue[];
    warnings: string[];
}
export interface VerifyServices {
    checkConnectionGeometry?: (diagram: LaidOutDiagram, rects: CheckRect[]) => Issue[];
    collectRects: (diagram: LaidOutDiagram) => CheckRect[];
    checkFigures: (diagram: LaidOutDiagram, tones: ToneEnv) => FigureCheck;
    contrastProblems: (diagram: LaidOutDiagram, tones: ToneEnv) => Issue[];
    lintDiagram: (diagram: LaidOutDiagram) => Verification['findings'];
    acceptHint: (rule: string) => string | undefined;
    mergeFindingSides: (light: Verification['findings'], dark: Verification['findings']) => Verification['findings'];
    hasMutedBox: (diagram: LaidOutDiagram) => boolean;
}
export declare function verifyWithServices(services: VerifyServices, d: LaidOutDiagram): Verdict;
type Verification = Required<Pick<Verdict, 'issues' | 'warnings' | 'findings'>>;
export {};
