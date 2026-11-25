import type { ToneEnv } from './tokens.ts';
import type { LaidOutChart } from './charts.ts';
import type { LaidOutDiagram } from './types/index.ts';
export declare function checkChart(band: LaidOutChart, d: Pick<LaidOutDiagram, 'day' | 'appearance'>, tones: ToneEnv): string[];
