// Compatibility entry for consistency checks over a complete diagram.
import {tableNumberFindings} from './table-number-rules.ts';
import type {Band} from './types/index.ts';
import type {Finding} from './types/verdicts.ts';

export {termFindings, termVariants, textsOf} from './term-rules.ts';
export {parseNum, type Num} from './table-number-rules.ts';

export function tableFindings(bands: readonly Band[]): Finding[] {
  return bands.flatMap(band => band.type === 'table' ? tableNumberFindings(band) : []);
}
