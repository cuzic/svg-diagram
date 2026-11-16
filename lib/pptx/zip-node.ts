// The zip writer with Node's raw deflate (level 6), as the Node CLI writes it.
import {deflateRawSync} from 'node:zlib';
import {zipEntries} from './zip.ts';

export function zipStore(entries: readonly {name: string; data: Uint8Array}[]): Buffer {
  return Buffer.from(zipEntries(entries.map(e => ({...e, deflated: deflateRawSync(e.data, {level: 6})}))));
}
