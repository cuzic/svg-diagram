export interface ChangedOpts {
    /** Absolute paths of the files that changed (git diff + untracked). */
    changed: ReadonlySet<string>;
    /** The committed SVG of a source (--drift), if the caller looks at it. */
    svgOf?: (source: string) => string | undefined;
    /** Swappable for tests. */
    depsOf?: (source: string) => string[];
}
export declare function selectChanged(sources: readonly string[], { changed, svgOf, depsOf }: ChangedOpts): {
    selected: string[];
    skipped: string[];
    reason: Map<string, string>;
};
