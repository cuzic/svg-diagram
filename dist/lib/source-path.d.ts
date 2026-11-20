/**
 * The absolute path of a source named in a page. The source is imported and run, so it must be inside `root` (default: the
 * working folder): `/etc/x.diagram.ts`, `//host/share/x.diagram.ts`, `C:\x.diagram.ts` and `../../x.diagram.ts` out of the root throw.
 */
export declare function resolveSource(file: string, base: string, root?: string): string;
