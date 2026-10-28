import type { DiagramSource } from './types/core.ts';
import { type Freshness } from './freshness-judge.ts';
export type { Freshness };
/** The words for a stale figure (preview, show): what is out of date, and the command that fixes it. */
export declare const staleNotice: (f: Freshness, svgPath: string, cwd?: string) => {
    short: string;
    banner: string;
    long: string;
};
/** The provenance embedded in an SVG (what build() wrote), or null: no metadata (hand-made, other tool), unreadable, or not JSON. */
export declare function readProvenance(svgPath: string): DiagramSource | null;
/** The first source file on disk the SVG may have been built from; null when there is none (then nothing is judged). */
export declare function locateSource(prov: DiagramSource, { svgPath, cwd }: {
    svgPath: string;
    cwd?: string;
}): string | null;
/** sha256 hex of a string or buffer: the one hash definition build, check and freshness share. */
export declare function sha256(data: string | Buffer): string;
export declare function sha256File(file: string): string;
/** Is the SVG still what its source would build? Reads the candidates and hashes them; the judgement is judgeFreshness(). unknown on any read failure. */
export declare function freshness(svgPath: string, cwd?: string): Freshness;
/** Did this SVG come from `sourcePath`? By the embedded source path only (the hash of a failed build never matches). */
export declare function ownsOutput(svgPath: string, sourcePath: string, cwd?: string): boolean;
