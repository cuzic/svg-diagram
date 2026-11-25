import type { ChartOpts } from './charts-base.ts';
import type { ChartBand } from './charts.ts';
export declare function chartBandOptions(who: string, opts: ChartOpts): Pick<ChartBand, 'id' | 'width' | 'height' | 'labelRole' | 'scope' | 'reveal' | 'until'>;
