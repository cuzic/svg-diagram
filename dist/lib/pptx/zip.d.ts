export declare function crc32(data: Uint8Array): number;
export interface ZipEntry {
    name: string;
    data: Uint8Array;
    deflated?: Uint8Array;
}
export declare function zipEntries(entries: readonly ZipEntry[]): Uint8Array;
export declare function concat(parts: readonly Uint8Array[]): Uint8Array;
