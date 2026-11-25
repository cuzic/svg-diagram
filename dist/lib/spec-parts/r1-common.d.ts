import type { Json, JsonSchema, SpecIssue } from '../spec-kit.ts';
export declare const UNIT: JsonSchema;
export declare const BAR_TONE: JsonSchema;
export declare const DIR: (what: string) => JsonSchema;
/** Labels that repeat in `list` are reported at the second one. */
export declare function uniqueLabels(entries: readonly Json[], at: string, what: string, issues: SpecIssue[], key?: string): void;
export declare const nums: (v: unknown) => number[];
