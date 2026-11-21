export type SourceLoc = {
    file: string;
    line: number;
    column: number;
};
type ResolvedLocation = {
    loc?: SourceLoc;
    via: SourceLoc[];
};
type ErrorStack = {
    stack?: string;
    frames?: readonly SourceLoc[];
    code?: unknown;
    message?: string;
};
type SourceContext = {
    source: string;
    cwd: string;
    packageDir: string;
    realpath: (file: string) => string;
    readSource?: (file: string) => string | undefined;
};
export declare function resolveErrorLocation(error: ErrorStack, context: SourceContext): ResolvedLocation;
export {};
