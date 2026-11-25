import type { Json, JsonSchema, SpecIssue } from '../spec-kit.ts';
export declare const UNIT: JsonSchema;
export declare const COUNT: JsonSchema;
/** The legend's cross: the fonts of a Worker have × but no ✕. */
export declare const CROSS = "\u00D7";
/** Raw measurements a chart works its statistics out of. */
export declare const MAX_VALUES = 300;
export declare function uniqueLabels(entries: readonly Json[], at: string, what: string, issues: SpecIssue[]): void;
export declare const notDefined: (part: Json, keys: readonly string[]) => string[];
/** The data a control chart takes, by kind of chart. */
export declare const CONTROL_DATA: Record<string, 'values' | 'subgroups' | 'samples'>;
