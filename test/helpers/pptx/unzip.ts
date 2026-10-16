import {inflateRawSync} from 'node:zlib';

// Reads one entry of a zip written by lib/pptx/zip.ts (local headers only; stored or deflated).
export function unzipEntry(zip: Buffer, wanted: string): Buffer {
  let off = 0;
  while (off + 30 <= zip.length && zip.readUInt32LE(off) === 0x04034b50) {
    const method = zip.readUInt16LE(off + 8), size = zip.readUInt32LE(off + 18), nameLen = zip.readUInt16LE(off + 26), extraLen = zip.readUInt16LE(off + 28);
    const name = zip.subarray(off + 30, off + 30 + nameLen).toString();
    const start = off + 30 + nameLen + extraLen, body = zip.subarray(start, start + size);
    if (name === wanted) return method === 8 ? inflateRawSync(body) : body;
    off = start + size;
  }
  throw new Error(`${wanted} not found in zip`);
}
