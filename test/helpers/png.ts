// A tiny PNG made in memory (a few coloured blocks), so the image tests need no binary fixture in the repository.
import zlib from 'node:zlib';

const crc = (b: Buffer): number => zlib.crc32(b);
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

/** A w x h RGB PNG: each pixel is `paint(x, y)` as [r, g, b]. */
export function makePng(w: number, h: number, paint: (x: number, y: number) => [number, number, number] = (x, y) => [(x * 255 / w) | 0, (y * 255 / h) | 0, 128]): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(paint(x, y), y * (w * 3 + 1) + 1 + x * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A pretend kitchen: a dark counter, a pale wall, a red pot and a blue window. For examples and tests that need something to point at. */
export const kitchenPng = (): Buffer => makePng(240, 160, (x, y) => {
  if (y > 110) return [90, 70, 50];
  if (x > 150 && x < 220 && y > 20 && y < 80) return [90, 150, 210];
  if (x > 40 && x < 90 && y > 70 && y <= 110) return [190, 60, 50];
  return [235, 228, 210];
});
