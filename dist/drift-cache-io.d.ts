import type { Config } from './lib/types/project.ts';
/** Hash over lib/, the CLI files next to it, package.json and the installed versions of the packages the output depends on. */
export declare function toolHash(): string;
/** The installed fonts (fc-list) and the font-related variables: a different font is a different measure. */
export declare function fontEnvHash(): string;
/** Run `fn` and note every file it reads and every path it asks about. Notes accumulate over the process (a font read once serves every later source). */
export declare function recordReads<T>(fn: () => Promise<T>): Promise<T>;
export interface DriftCache {
    /** the key for this source, or null when the build cannot be fully described (then nothing is cached) */
    keyFor(abs: string, svg: string, provenance: string): string | null;
    hit(abs: string, key: string): boolean;
    store(abs: string, key: string): void;
}
export declare function openDriftCache(dir: string, config: Config): DriftCache | null;
