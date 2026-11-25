import type { ToneEnv } from './tokens.ts';
import type { DiagramData } from './types/core.ts';
import type { Finding } from './types/verdicts.ts';
export declare const GRAY_MIN_DL = 10;
export declare function grayToneFindings(d: Pick<DiagramData, 'day' | 'appearance'>, tones: ToneEnv, samples: Iterable<readonly [object, readonly string[]]>): Finding[];
