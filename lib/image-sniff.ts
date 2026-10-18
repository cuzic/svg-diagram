// What a picture's bytes are (ADR 0031): the type and size from the header, and a ready data: URI. Pure: image() uses it for a data URI
// at once; lib/image-file.ts reads the files and hands the bytes here.
/** A hard limit: a bigger file is almost certainly a photo that should be resized first. */
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export interface ImageFile {href: string; w: number; h: number; bytes: number; mime: string}

/** The size of a PNG / JPEG / GIF / WebP from its header, or null when the bytes are none of those. */
export function sniffImage(b: Buffer): {mime: string; w: number; h: number} | null {
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a) return {mime: 'image/png', w: b.readUInt32BE(16), h: b.readUInt32BE(20)};
  if (b.length >= 10 && b.toString('latin1', 0, 3) === 'GIF') return {mime: 'image/gif', w: b.readUInt16LE(6), h: b.readUInt16LE(8)};
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return {mime: 'image/jpeg', h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7)};
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  }
  if (b.length >= 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const kind = b.toString('latin1', 12, 16);
    if (kind === 'VP8X') return {mime: 'image/webp', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3)};
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return {mime: 'image/webp', w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff)}; }
    if (kind === 'VP8 ') return {mime: 'image/webp', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff};
  }
  return null;
}

/** The embedded form of a picture's bytes, or the reason it cannot be one (as an Error to throw). */
export function describeImage(buf: Buffer): ImageFile {
  if (buf.length > IMAGE_MAX_BYTES) throw new Error(`image(): ${Math.round(buf.length / 1024)} KB is over the ${IMAGE_MAX_BYTES / 1024 / 1024} MB limit — resize it first`);
  const info = sniffImage(buf);
  if (!info) throw new Error('image(): only PNG, JPEG, GIF and WebP files are embedded (SVG is not: draw it with the other parts)');
  if (!(info.w > 0 && info.h > 0)) throw new Error('image(): the file reports a size of 0');
  return {href: `data:${info.mime};base64,${buf.toString('base64')}`, w: info.w, h: info.h, bytes: buf.length, mime: info.mime};
}

/** The picture a `data:image/…;base64,` URI holds. */
export function readDataImage(src: string): ImageFile {
  const m = /^data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)$/.exec(src);
  if (!m) throw new Error('image(): a data URI must be data:image/png|jpeg|gif|webp;base64,…');
  return describeImage(Buffer.from(m[1], 'base64'));
}
