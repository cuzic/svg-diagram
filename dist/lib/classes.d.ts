import type { FontFamily, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { ClassesBand, LaidOutClasses } from './types/diagrams.ts';
export declare const RELATION_KINDS: readonly ['assoc', 'arrow', 'inherit', 'implement', 'compose', 'aggregate', 'depend'];
export declare function classesTexts(band: ClassesBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutClassesBand(band: ClassesBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number): LaidOutClasses;
