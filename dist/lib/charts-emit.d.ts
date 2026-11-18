import type { LaidOutChart } from './charts.ts';
import type { Theme } from './types/core.ts';
export declare function renderChart(b: LaidOutChart, day: Theme, emojiSpan: (s: string) => string, stage?: number, dimFill?: boolean): string;
