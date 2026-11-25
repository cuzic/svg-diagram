import type { Band } from './types/index.ts';
import type { Finding, LintTarget } from './types/verdicts.ts';
export declare function graphFindings(d: Pick<LintTarget, 'bands' | 'laidOut' | 'connects'>, walk: (bands: Band[]) => readonly Band[], itemIdsOf: (band: Band) => readonly string[]): Finding[];
