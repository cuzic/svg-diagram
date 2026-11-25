import type { ToneEnv } from './tokens.ts';
import type { Theme } from './types/core.ts';
import type { LaidOutBpmn } from './types/diagrams.ts';
export declare function renderBpmn(b: LaidOutBpmn, day: Theme, tones: ToneEnv): string;
