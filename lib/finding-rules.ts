// Source references stay lazy until the CLI resolves a finding.
import {sourceOf} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import type {Issue} from './types/verdicts.ts';

/** The first marked part is the primary location; the other marked parts are related. */
export function at(band: object | undefined, ...relatedBands: object[]): Pick<Issue, 'loc' | 'related'> {
  const loc = band && sourceOf(band);
  if (!relatedBands.length) return loc ? {loc} : {};
  return fromSources([loc, ...relatedBands.map(b => sourceOf(b))]);
}

export function fromSources(refs: Iterable<SourceRef | undefined>): Pick<Issue, 'loc' | 'related'> {
  const sources = new Set<SourceRef>();
  for (const ref of refs) if (ref) sources.add(ref);
  const [loc, ...related] = sources;
  return loc ? {loc, ...(related.length ? {related} : {})} : {};
}
