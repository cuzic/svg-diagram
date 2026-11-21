export interface TargetIO {
    /** Is there a regular file at this absolute path? */
    isFile(abs: string): boolean;
    /** Absolute paths matching a pattern given relative to the working directory (for a quoted glob the shell did not expand). */
    glob(pattern: string): string[];
}
export interface TargetProblem {
    arg: string;
    message: string;
}
export interface Targets {
    files: string[];
    problems: TargetProblem[];
}
export declare const isSourcePath: (a: string) => boolean;
/** `svgDirs`: the folders a project names (`--svg-dir`, `outDir`), relative to cwd, tried first for a source's SVG. */
export declare function resolveTargets(args: string[], o: {
    cwd: string;
    io: TargetIO;
    svgDirs: string[];
}): Targets;
