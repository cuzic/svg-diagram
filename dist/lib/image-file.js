// Reading a picture for image() (ADR 0031): a path, a file URL or a data URI -> a data URI and the picture's size. The only part of image()
// that touches the disk, so it is kept out of the rendering core (lib/image.ts), which has to stay free of I/O.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeImage, readDataImage } from './image-sniff.js';
import { atBand } from './source-ref.js';
export { IMAGE_MAX_BYTES, sniffImage } from './image-sniff.js';
let onRead = null;
/** Have every picture file read from now on reported to `fn` (null: stop): what `serve` watches (ADR 0056 D5). */
export function recordImageReads(fn) { onRead = fn; }
/** `src`: a file path (relative: from `baseDir` — the folder of the diagram source, else the working folder), a file: URL (`new URL('./a.png', import.meta.url)`), or a ready `data:image/…;base64,` URI. */
export function readImage(src, baseDir = process.cwd()) {
    if (typeof src === 'string' && src.startsWith('data:'))
        return readDataImage(src);
    const file = src instanceof URL ? fileURLToPath(src) : src.startsWith('file:') ? fileURLToPath(src) : path.resolve(baseDir, String(src));
    onRead?.(file);
    let buf;
    try {
        buf = fs.readFileSync(file);
    }
    catch (e) {
        throw new Error(`image(): cannot read ${file} (${e.code ?? e.message})`);
    }
    return describeImage(buf);
}
export function resolveImageBand(band, baseDir) {
    if (!band.unresolved)
        return;
    atBand(band, () => {
        const file = readImage(band.src, baseDir);
        band.href = file.href;
        band.naturalW = file.w;
        band.naturalH = file.h;
        band.bytes = file.bytes;
        delete band.unresolved;
    });
}
/** Read the pictures image() left for later, relative to the diagram's source. */
export function resolveImages(bands, baseDir) {
    for (const band of bands)
        if (band.type === 'image')
            resolveImageBand(band, baseDir);
}
