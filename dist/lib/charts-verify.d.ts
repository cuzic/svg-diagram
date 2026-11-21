import type { ToneEnv } from './tokens.ts';
import type { LaidOutChart } from './charts.ts';
import type { LaidOutDiagram } from './types/index.ts';
export declare function checkChart(band: LaidOutChart, d: LaidOutDiagram, tones: ToneEnv): string[];
export declare function checkCharts(d: LaidOutDiagram, tones: ToneEnv): string[];
