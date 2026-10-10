/** Absolute paths of the local files `entry` imports, directly or not (not including `entry`), sorted. */
export declare function localDeps(entry: string): string[];
/** The imported local files, and the files whose imports this scan cannot follow (an import() built from a variable). */
export declare function depsOf(entry: string): {
    files: string[];
    unfollowable: string[];
};
/** sha256 over the imported files' contents (named relative to the source, so moving the project keeps it); '' when there are none. */
export declare function depsSha256(entry: string): string;
