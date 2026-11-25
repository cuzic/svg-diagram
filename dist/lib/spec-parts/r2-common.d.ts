import type { Json, JsonSchema, SpecIssue } from '../spec-kit.ts';
export declare const unit: (description?: string) => JsonSchema;
export declare const isNum: (v: unknown) => v is number;
/** A value that must be above 0 (an area, a thickness): the schema allows 0, this reports it at its place. */
export declare function positive(v: unknown, path: string, what: string, issues: SpecIssue[]): void;
/** `min` below `max` when both are given. */
export declare function minBelowMax(o: Json | undefined, at: string, issues: SpecIssue[]): void;
