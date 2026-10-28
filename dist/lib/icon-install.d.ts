import type { IconManifest, IconSpec, InstalledIcon } from './icon-store.ts';
export type Fetch = (url: string) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}>;
export interface InstallOpts {
    /** Iconify API root (SVG_DIAGRAM_ICONIFY_API overrides it, for a mirror or a test server). */
    api?: string;
    fetch?: Fetch;
    /** Licences to accept besides the permissive ones (SPDX ids). */
    allowLicense?: string[];
    /** Accept icons with colours of their own (they do not follow the tone / dark theme). */
    color?: boolean;
    cwd?: string;
    /** A name the set does not have is left out (and listed in `skipped`) instead of failing the whole add. Licence / colour / format errors still fail. */
    skipMissing?: boolean;
}
export declare const DEFAULT_API = "https://api.iconify.design";
export interface IconifySet {
    prefix: string;
    icons: Record<string, {
        body: string;
        width?: number;
        height?: number;
        left?: number;
        top?: number;
        rotate?: number;
        hFlip?: boolean;
        vFlip?: boolean;
    }>;
    aliases?: Record<string, {
        parent: string;
        body?: string;
        rotate?: number;
        hFlip?: boolean;
        vFlip?: boolean;
        width?: number;
        height?: number;
    }>;
    width?: number;
    height?: number;
    not_found?: string[];
}
export interface CollectionInfo {
    name?: string;
    author?: {
        name?: string;
    };
    license?: {
        spdx?: string;
        title?: string;
        url?: string;
    };
    palette?: boolean;
}
export declare function getJson<T>(f: Fetch, url: string): Promise<T>;
/** Where this project's manifest is (nearest parent), or where `add` would create it (here). */
export declare function manifestPath(cwd?: string): string;
export declare function readManifest(file: string): IconManifest;
export declare function writeManifest(file: string, m: IconManifest): void;
/** Run `fn` holding an exclusive lock (<manifest>.lock, created with O_EXCL) so that read-modify-write cycles of parallel runs do not lose each other's updates. A lock left by a dead process is taken over. */
export declare function withManifestLock<T>(file: string, fn: () => T, timeoutMs?: number): T;
/** Fetch and convert the icons for `specs`. Nothing is written; any failure throws, so one bad pick installs none. */
export declare function resolveSpecs(specs: IconSpec[], opts?: InstallOpts, skipped?: string[]): Promise<Record<string, InstalledIcon>>;
export declare function addIcons(args: string[], opts?: InstallOpts & {
    keepExisting?: boolean;
}): Promise<{
    file: string;
    added: string[];
    replaced: string[];
    kept: string[];
    skipped: string[];
    warnings: string[];
}>;
/** Install a recommended set (see icon-sets.ts) through the ordinary `icons add` path. Names already installed are kept, not overwritten. */
export declare function addSet(name: string, opts?: InstallOpts): Promise<{
    file: string;
    added: string[];
    replaced: string[];
    kept: string[];
    skipped: string[];
    warnings: string[];
}>;
export declare function removeIcons(names: string[], cwd?: string): {
    file: string;
    removed: string[];
};
export declare function searchIcons(query: string, opts?: InstallOpts & {
    set?: string;
    limit?: number;
}): Promise<string[]>;
/** Markdown for a NOTICE / credits page: who made the icons the project installed, under which licence. */
export declare function noticeText(m: IconManifest): string;
export declare function setMainSet(prefix: string | undefined, cwd?: string): {
    file: string;
    mainSet?: string;
};
/** One line naming the manifest file a command wrote (absolute), and saying so when it was found in a parent directory rather than the current one. */
export declare function manifestNote(file: string, cwd?: string): string;
