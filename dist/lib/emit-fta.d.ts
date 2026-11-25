import type { ToneEnv } from './tokens.ts';
import type { Theme } from './types/core.ts';
import type { LaidOutFta } from './types/diagrams.ts';
export { gatePath, markPath, ftaLegendSwatch } from './emit-fta-symbols.ts';
export declare function renderFta(b: LaidOutFta, day: Theme, tones: ToneEnv): string;
