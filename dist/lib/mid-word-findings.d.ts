import type { Finding, LintTarget } from './types/verdicts.ts';
export declare function midWordFindings(d: Pick<LintTarget, 'bands' | 'laidOut'>): Finding[];
