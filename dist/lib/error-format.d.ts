import type { SourceLoc } from './source-location.ts';
export declare function errorMessage(err: unknown): string;
export declare function buildErrorSite(source: string, loc?: SourceLoc): string;
export declare function formatBuildError(source: string, err: unknown, env?: NodeJS.ProcessEnv): string;
