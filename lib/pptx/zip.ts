// A minimal, deterministic zip writer (no dependency): entries in the order given, a fixed DOS date, no directory entries, raw deflate.
import {deflateRawSync, crc32} from 'node:zlib';

const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01 00:00:00

export function zipStore(entries: {name: string; data: Buffer}[]): Buffer {
  const chunks: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const {name, data} of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = deflateRawSync(data, {level: 6});
    const useDeflate = comp.length < data.length;
    const body = useDeflate ? comp : data;
    const crc = crc32(data);
    const flags = 0x0800; // UTF-8 names
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(flags, 8); cen.writeUInt16LE(useDeflate ? 8 : 0, 10);
    cen.writeUInt16LE(DOS_TIME, 12); cen.writeUInt16LE(DOS_DATE, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, end]);
}
