import { type ImageFile } from './image-sniff.ts';
import type { ImageBand } from './types/image.ts';
import type { Band } from './types/index.ts';
export { IMAGE_MAX_BYTES, sniffImage, type ImageFile } from './image-sniff.ts';
/** Have every picture file read from now on reported to `fn` (null: stop): what `serve` watches (ADR 0056 D5). */
export declare function recordImageReads(fn: ((file: string) => void) | null): void;
/** `src`: a file path (relative: from `baseDir` — the folder of the diagram source, else the working folder), a file: URL (`new URL('./a.png', import.meta.url)`), or a ready `data:image/…;base64,` URI. */
export declare function readImage(src: string | URL, baseDir?: string): ImageFile;
export declare function resolveImageBand(band: ImageBand, baseDir: string): void;
/** Read the pictures image() left for later, relative to the diagram's source. */
export declare function resolveImages(bands: readonly Band[], baseDir: string): void;
