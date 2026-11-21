/** Everything the key covers. Values are strings (hashes) or plain JSON. */
export interface DriftKeyParts {
    /** the tool's code and its dependencies (hash over lib/, the CLI files, package versions, node version) */
    tool: string;
    /** installed fonts and the font-related environment */
    fonts: string;
    /** the resolved .svg-diagram.json, the SVG_DIAGRAM_* variables, the CLI settings that reach the build (--today ...) */
    config: string;
    /** absolute path of the source (the base of relative image / icon paths) */
    source: string;
    sourceSha256: string;
    depsSha256: string;
    /** the committed SVG and its reveal files: name -> sha256 */
    committed: Record<string, string>;
    /** the provenance read from the committed SVG (what the rebuild is made to carry) */
    provenance: string;
}
export declare const DRIFT_CACHE_VERSION = 1;
export declare function driftKey(p: DriftKeyParts): string;
/** A file the build read: its path and the hash of its content (null: it did not exist). */
export interface ReadFile {
    path: string;
    sha256: string | null;
}
/** A path the build asked about without reading it (existsSync) and what it was told. */
export interface Probe {
    path: string;
    exists: boolean;
}
export interface DriftEntry {
    version: number;
    key: string;
    reads: ReadFile[];
    probes: Probe[];
}
export declare function makeEntry(key: string, reads: ReadFile[], probes: Probe[]): DriftEntry;
export declare function parseEntry(text: string): DriftEntry | null;
export interface World {
    /** sha256 of the file now, null when it is not there */
    hashOf(path: string): string | null;
    exists(path: string): boolean;
}
/** May the stored pass be trusted: the key is the one asked for and nothing the build read has changed since. */
export declare function entryHolds(entry: DriftEntry | null, key: string, world: World): boolean;
