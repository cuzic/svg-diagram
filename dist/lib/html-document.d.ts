import type { ToneEnv } from './tokens.ts';
import type { LaidOutDiagram } from './types/index.ts';
export declare function stripSvg(svg: string, cls: string): string;
export declare function htmlDocument(d: LaidOutDiagram, tones: ToneEnv, body: string, id?: string): string;
