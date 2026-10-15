import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {inflateRawSync} from 'node:zlib';
import {register} from 'node:module';
import test from 'node:test';
import {fitConnector, evalConnector, maxDeviation, type Pt} from '../lib/pptx/geom.ts';
import {zipStore} from '../lib/pptx/zip.ts';
import {emitPptx} from '../lib/pptx/emit.ts';
import {PPTX_CHART_HANDLERS, PPTX_HANDLERS} from '../lib/pptx/handlers.ts';
import {loadConfig} from '../lib/config.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {renderDiagram} from '../lib/dsl/render.ts';
import {closeMeasurer} from '../lib/measure.ts';
import {xmlProblems} from '../lib/xml-check.ts';

register(new URL('../lib/resolve-hook.ts', import.meta.url));

function unzipEntry(zip: Buffer, wanted: string): Buffer {
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

test('connector fitter covers fixed 1..5-segment orthogonal cases', () => {
  const lengths = [37, -53, 79, -41, 61];
  for (let n = 1; n <= 5; n++) for (const horizontal of [true, false]) for (let mask = 0; mask < 1 << n; mask++) {
    const points: Pt[] = [{x: 300, y: 300}];
    let h = horizontal;
    for (let i = 0; i < n; i++) {
      const p = points[i]!, d = lengths[i]! * (mask & 1 << i ? -1 : 1);
      points.push(h ? {x: p.x + d, y: p.y} : {x: p.x, y: p.y + d}); h = !h;
    }
    const fit = fitConnector(points);
    assert.equal(fit.ok, true);
    if (fit.ok) assert.ok(maxDeviation(points, evalConnector(fit.x)) < 0.001);
  }
});

test('zip writer is byte deterministic and ignores wall clock', () => {
  const entries = [{name: 'a.txt', data: Buffer.from('same input')}, {name: 'b.xml', data: Buffer.from('<b/>')}];
  const a = zipStore(entries), b = zipStore(entries);
  assert.deepEqual(a, b);
  assert.equal(a.readUInt16LE(10), 0);
  assert.equal(a.readUInt16LE(12), ((2026 - 1980) << 9) | (1 << 5) | 1);
});

test('PPTX handler registries explicitly classify bands and chart kinds', () => {
  assert.equal(PPTX_HANDLERS.table.mode, 'native');
  assert.equal(PPTX_HANDLERS.chart.mode, 'image');
  assert.ok(Object.keys(PPTX_HANDLERS).length >= 30);
  assert.ok(Object.keys(PPTX_CHART_HANDLERS).length >= 19);
});

const has = (command: string): boolean => { try { execFileSync('sh', ['-c', `command -v ${command}`], {stdio: 'ignore'}); return true; } catch { return false; } };
for (const judge of ['judge-geom.ts', 'judge-glue.ts']) test(`LibreOffice outside judge: ${judge}`, {skip: !(has('soffice') && has('pdftocairo')), timeout: 180_000}, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-diagram-pptx-'));
  execFileSync(process.execPath, [path.resolve('test/helpers/pptx', judge), dir], {stdio: 'pipe', timeout: 150_000});
});

test('example PPTX files have sound slide relationships', async t => {
  for (const source of ['examples/arrow-weight.ts', 'examples/table-row-header.ts', 'examples/bars-bare.ts']) await t.test(source, async () => {
    const abs = path.resolve(source), config = loadConfig(path.dirname(abs));
    const regular = '/home/cuzic/.local/share/fonts/BIZ-UDGothicR.ttc', bold = '/home/cuzic/.local/share/fonts/BIZ-UDGothicB.ttc';
    const diagram = await loadDiagram(abs, fs.existsSync(regular) && fs.existsSync(bold) ? {...config, measure: 'font', fonts: {sans: {regular: `${regular}#1`, bold: `${bold}#1`}, mono: {regular: `${regular}#0`, bold: `${bold}#0`}}} : config);
    const rendered = await renderDiagram(diagram, {name: path.basename(source, '.ts') + '.svg', budget: 'cacheOnly'});
    const a = emitPptx(rendered.laidOut, {name: source}), b = emitPptx(rendered.laidOut, {name: source});
    assert.deepEqual(a, b);
    const xml = unzipEntry(a, 'ppt/slides/slide1.xml').toString();
    assert.deepEqual(xmlProblems(xml), []);
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => m[1]!);
    assert.equal(new Set(ids).size, ids.length);
    for (const m of xml.matchAll(/<a:(?:stCxn|endCxn) id="(\d+)"/g)) assert.ok(ids.includes(m[1]!));
    try {
      execFileSync('xmllint', ['--noout', '-'], {input: xml, stdio: ['pipe', 'ignore', 'pipe']});
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  });
});

test.after(async () => { await closeMeasurer(); });
