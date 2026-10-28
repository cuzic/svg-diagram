import { type ImageFile } from './image-sniff.ts';
import type { Band } from './types/index.ts';
export { IMAGE_MAX_BYTES, sniffImage, type ImageFile } from './image-sniff.ts';
/** `src`: a file path (relative: from `baseDir` — the folder of the diagram source, else the working folder), a file: URL (`new URL('./a.png', import.meta.url)`), or a ready `data:image/…;base64,` URI. */
export declare function readImage(src: string | URL, baseDir?: string): ImageFile;
/** Read the pictures image() left for later (bands with `unresolved`), relative paths from `baseDir`. Writes into the bands it is given. */
export declare function resolveImages(bands: readonly Band[], baseDir: string): void;
