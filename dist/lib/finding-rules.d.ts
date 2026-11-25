import type { DiagramData } from './types/core.ts';
import type { SourceRef } from './source-ref.ts';
import type { Finding, Issue } from './types/verdicts.ts';
/** The first marked part is the primary location; the other marked parts are related. */
export declare function at(band: object | undefined, ...relatedBands: object[]): Pick<Issue, 'loc' | 'related'>;
export declare function fromSources(refs: Iterable<SourceRef | undefined>): Pick<Issue, 'loc' | 'related'>;
/** Band analysis can specify a fixed severity or inherit the diagram's default. */
export declare function analysisFindings(band: object, notes: readonly {
    rule: string;
    message: string;
    severity?: 'info' | 'warn';
}[], severity?: 'info' | 'warn'): Finding[];
/** Keep an accepted finding at information level and record the author's reason. */
export declare function applyFindingAcceptance(finding: Finding, accept: DiagramData['accept']): Finding;
/** Format the guidance for a documented rule. */
export declare function findingAcceptanceHint(rule: string): string;
