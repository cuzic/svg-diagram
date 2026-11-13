// A minimal, deterministic zip writer (no dependency, no node:*): entries in the order given, a fixed DOS date, no directory entries.
// Compression is the caller's: `deflated` is the raw-deflate form of `data`, kept only when it is smaller (Node: zip-node.ts; a Worker:
// CompressionStream). Without it the entry is stored.

const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01 00:00:00

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {name: string; data: Uint8Array; deflated?: Uint8Array}

export function zipEntries(entries: readonly ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const {name, data, deflated} of entries) {
    const nameBuf = enc.encode(name);
    const useDeflate = deflated !== undefined && deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const flags = 0x0800; // UTF-8 names
    const local = new Uint8Array(30), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, flags, true); l.setUint16(8, useDeflate ? 8 : 0, true);
    l.setUint16(10, DOS_TIME, true); l.setUint16(12, DOS_DATE, true); l.setUint32(14, crc, true);
    l.setUint32(18, body.length, true); l.setUint32(22, data.length, true); l.setUint16(26, nameBuf.length, true); l.setUint16(28, 0, true);
    chunks.push(local, nameBuf, body);
    const cen = new Uint8Array(46), c = new DataView(cen.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, flags, true); c.setUint16(10, useDeflate ? 8 : 0, true);
    c.setUint16(12, DOS_TIME, true); c.setUint16(14, DOS_DATE, true); c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, nameBuf.length, true); c.setUint32(42, offset, true);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const cdLength = central.reduce((n, b) => n + b.length, 0);
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, cdLength, true); e.setUint32(16, offset, true);
  return concat([...chunks, ...central, end]);
}

export function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
