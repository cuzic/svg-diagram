import type { FtaBand } from './types/diagrams.ts';
export type FtaRule = 'fta-gate-one-input' | 'fta-vote-degenerate' | 'fta-top-is-leaf' | 'fta-undeveloped-left' | 'fta-single-point';
export interface FtaFinding {
    rule: FtaRule;
    message: string; /** Fixed: reported at this severity whatever diagram({rcaCheck}) says. */
    severity?: 'info';
}
export declare function ftaFindings(band: Pick<FtaBand, 'root' | 'id'>): FtaFinding[];
