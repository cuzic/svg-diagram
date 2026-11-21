export interface ViewerOptions {
    /** Reserved (the overview's columns are passed to buildDeck as `cols`). */
    [key: string]: unknown;
}
/** The one script: state.js (its `export`s dropped) followed by viewer.js (its `import` of state.js dropped), in a function scope. Exported for the tests. */
export declare function joinScript(state: string, viewer: string): string;
export declare function viewerAssets(_opts?: ViewerOptions): {
    css: string;
    js: string;
};
