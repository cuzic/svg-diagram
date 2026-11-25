import type { BandDef, SpotlightHooks } from './band-def.ts';
import type { ChartBand, LaidOutChart } from './charts.ts';
export declare const chartSpotlight: SpotlightHooks<never, LaidOutChart>;
export declare const emitSpotlightChart: BandDef<ChartBand, LaidOutChart>['emit'];
