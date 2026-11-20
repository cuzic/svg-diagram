import type { Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { BowtieBand, BowtieInput, LaidOutBowtie } from './types/diagrams.ts';
/** Validates the input (every error throws, naming the part). */
export declare function bowtieCheck(input: BowtieInput): void;
export declare function bowtieTextList(band: Pick<BowtieBand, 'hazard' | 'event' | 'threats' | 'consequences'>): string[];
export declare function bowtieMeasure(band: BowtieBand, roles: Roles): [string, number, number, 'sans'][];
export declare function layoutBowtie(band: BowtieBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutBowtie;
