import type { ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutBox } from '../types/text-bands.ts';
import { type Fonts } from './xml.ts';
type Run = LaidOutBox['wrappedRuns'][number];
/** Line pitch of a run: measured when it wraps, the nominal line height otherwise. */
export declare const pitchOf: (r: Run) => number;
export declare function runXml(text: string, size: number, bold: boolean, mono: boolean, color: string, fonts: Fonts): string;
export declare function paragraphsOf(runs: Run[], boxTone: string | undefined, day: LaidOutDiagram['day'], tones: ToneEnv, align: string, fonts: Fonts): string;
export {};
