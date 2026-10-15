// Runs every example through the spike and totals what the spike is meant to judge.
import fs from 'node:fs';
import path from 'node:path';
import {register} from 'node:module';
import {closeMeasurer} from '../../lib/measure.ts';
import {buildSlide, packPptx, loadLaidOut} from './run.ts';
import {fitConnector} from './geom.ts';
import {createHash} from 'node:crypto';

register(new URL('../../lib/resolve-hook.ts', import.meta.url));
const files = fs.readdirSync('examples').filter(f => f.endsWith('.ts')).sort();
const tot = {files: 0, loadFail: [] as string[], connects: 0, glued: 0, half: 0, unglued: 0, fitFail: {} as Record<string, number>, worst: 0, worstFile: '', dupIds: 0, glueEnds: 0, offCentre: 0, nondeterministic: [] as string[], prst: {} as Record<string, number>, native: 0, unhandled: {} as Record<string, number>, native_bands: {} as Record<string, number>};
const outDir = process.argv[2];
for (const f of files) {
  let laid;
  try { laid = (await loadLaidOut(path.join('examples', f))).laidOut; } catch (e) { tot.loadFail.push(`${f}: ${(e as Error).message.split('\n')[0]}`); continue; }
  tot.files++;
  const b = buildSlide(laid, f);
  const r = b.report;
  tot.connects += r.connects; tot.glued += r.glued; tot.half += r.halfGlued; tot.unglued += r.unglued;
  for (const x of r.fitFailed) tot.fitFail[x.why] = (tot.fitFail[x.why] ?? 0) + 1;
  if (r.worstDeviationPx > tot.worst) { tot.worst = r.worstDeviationPx; tot.worstFile = f; }
  tot.dupIds += r.dupIds; tot.glueEnds += r.glueEnds; tot.offCentre += r.offCentreEnds; tot.native += r.nativeShapes;
  for (const [k, v] of Object.entries(r.segHist)) tot.prst[k] = (tot.prst[k] ?? 0) + (v as number);
  for (const [k, v] of Object.entries(r.unhandledBands)) tot.unhandled[k] = (tot.unhandled[k] ?? 0) + v;
  for (const [k, v] of Object.entries(r.bandTypes)) tot.native_bands[k] = (tot.native_bands[k] ?? 0) + v;
  const a = packPptx(b.xml, b.widthEmu, b.heightEmu), c = packPptx(b.xml, b.widthEmu, b.heightEmu);
  if (createHash('sha256').update(a).digest('hex') !== createHash('sha256').update(c).digest('hex')) tot.nondeterministic.push(f);
  if (outDir) fs.writeFileSync(path.join(outDir, f.replace(/\.ts$/, '.pptx')), a);
}
console.log(JSON.stringify(tot, null, 1));
closeMeasurer();
