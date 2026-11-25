import type { DiagramData } from './types/core.ts';
import type { Band, LaidOutDiagram } from './types/index.ts';
import type { Finding, LintTarget } from './types/verdicts.ts';
export declare function documentWidthFindings(d: Pick<DiagramData, 'medium' | 'canvas' | 'width' | 'maxWidth'>): Finding[];
export declare function wrapFallbackFindings(d: Pick<LaidOutDiagram, 'wrapFellBack'>): Finding[];
export declare function pictographFindings(d: Pick<LintTarget, 'laidOut'>): Finding[];
export declare function textBudgetFindings(d: Pick<LintTarget, 'medium' | 'laidOut'>): Finding[];
export declare function aspectTallFindings(d: Pick<LintTarget, 'medium' | 'canvas' | 'canvasHeight' | 'width'>, bands: () => readonly Band[]): Finding[];
export declare function missingTitleFindings(d: Pick<DiagramData, 'medium'>, title: string): Finding[];
/** Opt in to the document-wide geometry, wrapping, pictograph and text budget checks for selective rendering. */
export declare function documentFindings(diagram: LaidOutDiagram, stage?: number): Finding[];
export declare function documentAcceptHint(rule: string): string | undefined;
