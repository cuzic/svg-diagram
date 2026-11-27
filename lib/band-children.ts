// Which bands a band holds, read from its definition (`children`), so the walkers that follow nested bands (id lookup, the spotlight, the
// rules, the source locations) share one answer instead of each guessing at a `children` property.
//
// A band made by a selective builder carries its definition. Plain data from the all-in-one builders (dsl-pure) gets its definition only when
// a diagram is rendered, so the walkers that meet such data pass `definitionOf` (full-definitions.ts: `definitionOfBand`).

import {defOf} from './band-def.ts';
import type {BandDef} from './band-def.ts';
import type {Band} from './types/index.ts';

export type DefinitionOf = (band: Band) => BandDef | undefined;

/** The bands a band holds as children (none for most types). */
export function childrenOf(band: Band, definitionOf: DefinitionOf = defOf): Band[] {
  return definitionOf(band)?.children?.(band) ?? [];
}

/** Like childrenOf, plus a swimlane's steps: every band that sits inside another one. A `cols: 'auto'` figure holds nodes, not bands, so it has none. */
export function nestedBandsOf(band: Band, definitionOf: DefinitionOf = defOf): Band[] {
  return band.type === 'swimlane' ? (band.arrange === 'auto' ? [] : band.steps) : childrenOf(band, definitionOf);
}
