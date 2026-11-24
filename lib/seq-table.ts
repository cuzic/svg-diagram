import {sequenceTexts} from './layout-sequence.ts';
import {tableTexts} from './layout-table.ts';
import type {Roles, TextRequest} from './types/core.ts';
import type {SequenceBand, TableBand} from './types/sequence-table-swimlane.ts';

export {layoutSequence} from './layout-sequence.ts';
export {layoutTable} from './layout-table.ts';

export function collectTextRequests(band: SequenceBand | TableBand, roles: Roles): TextRequest[] {
  return band.type === 'sequence' ? sequenceTexts(band, roles) : tableTexts(band, roles);
}
