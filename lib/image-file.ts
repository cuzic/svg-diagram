// Reading a picture for image() (ADR 0031): a path, a file URL or a data URI -> a data URI and the picture's size. The only part of image()
// that touches the disk, so it is kept out of the rendering core (lib/image.ts), which has to stay free of I/O.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describeImage, readDataImage, type ImageFile} from './image-sniff.ts';
import type {Band} from './types/index.ts';
import {atBand} from './source-ref.ts';

export {IMAGE_MAX_BYTES, sniffImage, type ImageFile} from './image-sniff.ts';

let onRead: ((file: string) => void) | null = null;
/** Have every picture file read from now on reported to `fn` (null: stop): what `serve` watches (ADR 0056 D5). */
export function recordImageReads(fn: ((file: string) => void) | null): void { onRead = fn; }

/** `src`: a file path (relative: from `baseDir` — the folder of the diagram source, else the working folder), a file: URL (`new URL('./a.png', import.meta.url)`), or a ready `data:image/…;base64,` URI. */
export function readImage(src: string | URL, baseDir: string = process.cwd()): ImageFile {
  if (typeof src === 'string' && src.startsWith('data:')) return readDataImage(src);
  const file = src instanceof URL ? fileURLToPath(src) : src.startsWith('file:') ? fileURLToPath(src) : path.resolve(baseDir, String(src));
  onRead?.(file);
  let buf: Buffer;
  try { buf = fs.readFileSync(file); } catch (e) { throw new Error(`image(): cannot read ${file} (${(e as NodeJS.ErrnoException).code ?? (e as Error).message})`); }
  return describeImage(buf);
}

/** Read the pictures image() left for later (bands with `unresolved`), relative paths from `baseDir`. Writes into the bands it is given. */
export function resolveImages(bands: readonly Band[], baseDir: string): void {
  for (const b of bands) {
    if (b.type !== 'image' || !b.unresolved) continue;
    atBand(b, () => {
      const f = readImage(b.src, baseDir);
      b.href = f.href; b.naturalW = f.w; b.naturalH = f.h; b.bytes = f.bytes;
      delete b.unresolved;
    });
  }
}
