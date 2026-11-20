/** A hard limit: a bigger file is almost certainly a photo that should be resized first. */
export declare const IMAGE_MAX_BYTES: number;
export interface ImageFile {
    href: string;
    w: number;
    h: number;
    bytes: number;
    mime: string;
}
/** The size of a PNG / JPEG / GIF / WebP from its header, or null when the bytes are none of those. */
export declare function sniffImage(b: Buffer): {
    mime: string;
    w: number;
    h: number;
} | null;
/** The embedded form of a picture's bytes, or the reason it cannot be one (as an Error to throw). */
export declare function describeImage(buf: Buffer): ImageFile;
/** The picture a `data:image/…;base64,` URI holds. */
export declare function readDataImage(src: string): ImageFile;
