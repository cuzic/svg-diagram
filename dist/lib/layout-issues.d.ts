import type { SourceLoc } from './source-location.ts';
import type { SourceRef } from './source-ref.ts';
import type { Issue } from './types/verdicts.ts';
export type ResolveSource = (ref: SourceRef | undefined) => {
    loc?: SourceLoc;
    via: SourceLoc[];
};
export declare function findingLocation(file: string, { loc, via }: ReturnType<ResolveSource>): {
    via?: {
        line: number;
        column: number;
    }[] | undefined;
} | {
    line: number;
    column: number;
    location?: undefined;
    via?: {
        line: number;
        column: number;
    }[] | undefined;
} | {
    line?: undefined;
    column?: undefined;
    location: SourceLoc;
    via?: {
        line: number;
        column: number;
    }[] | undefined;
};
export declare function issueLocation(file: string, issue: Issue, resolve: ResolveSource): {
    via?: {
        line: number;
        column: number;
    }[] | undefined;
    related?: SourceLoc[] | undefined;
} | {
    line: number;
    column: number;
    location?: undefined;
    via?: {
        line: number;
        column: number;
    }[] | undefined;
    related?: SourceLoc[] | undefined;
} | {
    line?: undefined;
    column?: undefined;
    location: SourceLoc;
    via?: {
        line: number;
        column: number;
    }[] | undefined;
    related?: SourceLoc[] | undefined;
};
/** The JSON form shared by check and the build source map. */
export declare function layoutFinding(file: string, issue: Issue, resolve: ResolveSource): {
    via?: {
        line: number;
        column: number;
    }[] | undefined;
    related?: SourceLoc[] | undefined;
    file: string;
    rule: string;
    severity: 'error';
    message: string;
} | {
    line: number;
    column: number;
    location?: undefined;
    via?: {
        line: number;
        column: number;
    }[] | undefined;
    related?: SourceLoc[] | undefined;
    file: string;
    rule: string;
    severity: 'error';
    message: string;
} | {
    line?: undefined;
    column?: undefined;
    location: SourceLoc;
    via?: {
        line: number;
        column: number;
    }[] | undefined;
    related?: SourceLoc[] | undefined;
    file: string;
    rule: string;
    severity: 'error';
    message: string;
};
