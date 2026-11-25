import type { LaidOutDiagram } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
export declare function labelCoverFindings(d: Partial<Pick<LaidOutDiagram, 'connects'>>): Finding[];
