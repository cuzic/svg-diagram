import type { Json, SpecIssue } from '../spec-kit.ts';
/** Each value of `part[key]` once; a repeat is reported where it is. */
export declare function uniqueTexts(values: readonly unknown[], at: string, what: string, issues: SpecIssue[], key?: string): void;
export declare const lengthIs: (v: unknown, n: number, path: string, what: string, issues: SpecIssue[]) => void;
export declare const MAX_DAYS = 60;
/** The series of a burndown / burnup under the names a spec gives (the builder writes them in Japanese). */
export declare function renamed(made: [{
    label: string;
}[], Json], names: readonly (string | undefined)[]): [never, never];
export declare const axisLabels: (part: Json) => Json;
