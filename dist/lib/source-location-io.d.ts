import { resolveErrorLocation } from './source-location.ts';
import type { SourceRef } from './source-ref.ts';
export declare function installStackCapture(): void;
export declare function locateSource(ref: SourceRef | undefined, source: string): ReturnType<typeof resolveErrorLocation>;
export declare function locateError(thrown: unknown, source: string): ReturnType<typeof resolveErrorLocation>;
