import type { LaidOutCause } from './types/diagrams.ts';
export declare function causeFindings(band: LaidOutCause): {
    problems: string[];
    warnings: string[];
};
