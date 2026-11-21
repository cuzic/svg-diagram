import type { SourceRef } from './source-ref.ts';
import type { Issue } from './types/verdicts.ts';
/** The first marked part is the primary location; the other marked parts are related. */
export declare function at(band: object | undefined, ...relatedBands: object[]): Pick<Issue, 'loc' | 'related'>;
export declare function fromSources(refs: Iterable<SourceRef | undefined>): Pick<Issue, 'loc' | 'related'>;
