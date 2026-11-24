import {compareAxes, type ValueAxis} from './axis-comparison.ts';
import {nestedBandsOf} from './band-children.ts';
import {barsValueAxis} from './bars.ts';
import {waterfallValueAxis} from './charts-waterfall.ts';
import {stackedValueAxis} from './charts-stacked.ts';
import {tornadoValueAxis} from './charts-tornado.ts';
import type {Band} from './types/index.ts';

export type {ValueAxis} from './axis-comparison.ts';

export function valueAxisOf(band: Band): ValueAxis | undefined {
  if (band.type === 'bars') return barsValueAxis(band);
  if (band.type !== 'chart') return undefined;
  if (band.kind === 'waterfall') return waterfallValueAxis(band.spec as Parameters<typeof waterfallValueAxis>[0]);
  if (band.kind === 'stacked') return stackedValueAxis(band.spec as Parameters<typeof stackedValueAxis>[0]);
  if (band.kind === 'tornado') return tornadoValueAxis(band.spec as Parameters<typeof tornadoValueAxis>[0]);
  return undefined;
}

export function axisMismatches(bands: readonly Band[]): Map<string, Set<Band>> {
  return compareAxes(bands, valueAxisOf, nestedBandsOf);
}
