import type { DiagramSource } from './types/core.ts';
/** The provenance embedded in an SVG's text (what build() wrote), or null: no metadata (hand-made, other tool), or not JSON. */
export declare function parseProvenance(text: string): DiagramSource | null;
export interface Freshness {
    state: 'fresh' | 'stale' | 'unknown';
    /** stale only: the source itself changed, or a local file it imports. */
    reason?: 'source' | 'deps';
    /** The source that was found (fresh and stale). */
    source?: string;
}
/** A candidate source that exists on disk, with the hash of its content and of the local files it imports. */
export interface Found {
    source: string;
    sha: string;
    depsSha: string;
}
/**
 * fresh: the source and its imports hash as they did at build time. stale: they differ. unknown: nothing found, so nothing is claimed
 * (a hand-made SVG is never "stale"). The config hash and the tool version are not compared: a tool upgrade must not turn every figure
 * "stale" (`build --stale` and `check --drift --rebuild` do look at them).
 * A same-named file of another project may sit at one candidate: any candidate that hashes as recorded makes the SVG fresh; stale only
 * when every candidate differs (a false alarm is worse than a miss). When none is fresh, a candidate whose source hash matches is the
 * real one: its deps are what to report, not another file's source.
 */
export declare function judgeFreshness(prov: Pick<DiagramSource, 'sourceSha256' | 'depsSha256'>, found: readonly Found[]): Freshness;
/** The words for a stale figure (preview, show): what is out of date, and the command that fixes it. */
export declare function staleNoticeAt(f: Freshness, svgPath: string, cwd: string): {
    short: string;
    banner: string;
    long: string;
};
