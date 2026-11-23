// node spikes/band-plugin/bundle/prototype.ts — bundle sizes of the BandDef prototype entries (dispatch through the band value), next to today's.
import fs from 'node:fs';
import path from 'node:path';
import {bundle, kb, modules} from './measure.ts';

const D = path.resolve(import.meta.dirname, '../banddef');
const lines: string[] = [];
const rep = (s: string): void => { lines.push(s); console.log(s); };
for (const [name, file] of [['comic-only (mini-core + comic band)', 'entry-comic.ts'], ['box-only (mini-core + box band)', 'entry-box.ts'], ['box + comic', 'entry-box-comic.ts']] as const) {
  const b = await bundle(file.replace(/\W+/g, '-'), `export * from '${D}/${file}';`);
  const mods = modules(b.meta);
  rep(`\n## ${name}: ${kb(b.bytes)} minified, ${kb(b.gz)} gzip, ${mods.length} modules`);
  for (const m of mods.slice(0, 10)) rep(`   ${kb(m.bytes).padStart(9)}  ${m.file.replace(/^.*(lib\/|banddef\/)/, '$1')}`);
}
fs.writeFileSync(path.join(import.meta.dirname, '../out/bundle-prototype.txt'), lines.join('\n') + '\n');
