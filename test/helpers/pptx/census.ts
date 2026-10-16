// Counts what the .pptx files of a directory hold, for the numbers ADR 0027 quotes (native vs picture, glued connectors).
// usage: node test/helpers/pptx/census.ts <dir-with-.pptx>  (make them with `svg-diagram pptx examples/*.ts --out-dir <dir>`)
import fs from 'node:fs';
import path from 'node:path';
import {unzipEntry} from './unzip.ts';

const dir = process.argv[2];
if (!dir) { console.error('usage: node test/helpers/pptx/census.ts <dir>'); process.exit(2); }
const total = {files: 0, pictures: 0, connectors: 0, bothGlued: 0, oneGlued: 0, unglued: 0, prst: {} as Record<string, number>};
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.pptx')).sort()) {
  const xml = unzipEntry(fs.readFileSync(path.join(dir, file)), 'ppt/slides/slide1.xml').toString();
  total.files++;
  total.pictures += (xml.match(/<p:pic>/g) ?? []).length;
  for (const m of xml.matchAll(/<p:cxnSp>([\s\S]*?)<\/p:cxnSp>/g)) {
    total.connectors++;
    const glued = Number(m[1]!.includes('<a:stCxn')) + Number(m[1]!.includes('<a:endCxn'));
    if (glued === 2) total.bothGlued++; else if (glued === 1) total.oneGlued++; else total.unglued++;
    const prst = /prst="([^"]+)"/.exec(m[1]!)?.[1] ?? 'custGeom';
    total.prst[prst] = (total.prst[prst] ?? 0) + 1;
  }
}
console.log(JSON.stringify(total, null, 2));
