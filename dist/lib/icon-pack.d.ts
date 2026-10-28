export interface PackOpts {
    prefix: string;
    terms?: string;
    acceptTerms?: boolean;
    /** only files whose path matches */
    match?: RegExp;
    exclude?: RegExp;
    /** install everything (a pack has hundreds of icons: say so) */
    all?: boolean;
    /** report, write nothing */
    list?: boolean;
    cwd?: string;
    /** day recorded as the acceptance date (tests) */
    today?: string;
}
export interface PackResult {
    file: string;
    added: string[];
    replaced: string[];
    /** reason -> files */
    skipped: Record<string, string[]>;
    /** names two files claimed (the first, by size preference, won) */
    collisions: string[];
    listed: boolean;
}
export declare function addPack(src: string, o: PackOpts): PackResult;
