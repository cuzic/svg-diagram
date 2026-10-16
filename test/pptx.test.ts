import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {register} from 'node:module';
import test from 'node:test';
import {fitConnector, evalConnector, maxDeviation, type Pt} from '../lib/pptx/geom.ts';
import {zipStore} from '../lib/pptx/zip.ts';
import {emitPptx, fontFilesOf} from '../lib/pptx/emit.ts';
import {BAND_HANDLERS} from '../lib/pptx/bands.ts';
import {groupFrameXml} from '../lib/pptx/shapes.ts';
import {loadConfig} from '../lib/config.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {renderDiagram} from '../lib/dsl/render.ts';
import {closeMeasurer} from '../lib/measure.ts';
import {xmlProblems} from '../lib/xml-check.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';
import {hasXmllint, hasXsd, slideSchemaProblems} from './helpers/pptx/xsd.ts';

register(new URL('../lib/resolve-hook.ts', import.meta.url));

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

test('shape names are attribute-escaped and a zero-size group frame keeps a finite corner radius', () => {
  const xml = groupFrameXml(2, 'a"b&c', {x: 0, y: 0, w: 0, h: 40}, undefined, undefined, 1);
  assert.ok(xml.includes('name="a&quot;b&amp;c"'));
  assert.ok(!xml.includes('Infinity') && !xml.includes('NaN'));
  assert.deepEqual(xmlProblems(`<r xmlns:p="p" xmlns:a="a">${xml}</r>`), []);
});

test('a font name with a quote cannot break the run attribute', async () => {
  const {runXml} = await import('../lib/pptx/text.ts');
  const xml = runXml('x', 14, false, false, 'FFFFFF', {sans: 'A"B', mono: 'M'});
  assert.ok(xml.includes('typeface="A&quot;B"'));
});

test('the package template already declares png and svg (packageEntries adds no Default)', async () => {
  const {packageEntries} = await import('../lib/pptx/package.ts');
  const template = [{name: '[Content_Types].xml', data: fs.readFileSync(new URL('../lib/pptx/template/[Content_Types].xml', import.meta.url))}];
  const types = packageEntries(template, {xml: '<x/>', cx: 1, cy: 1, pictures: []}, []).find(e => e.name === '[Content_Types].xml')!.data.toString();
  assert.match(types, /Extension="png"/);
  assert.match(types, /Extension="svg"/);
  assert.throws(() => packageEntries(template, {xml: '<x/>', cx: 1, cy: 1, pictures: [{svg: '', pngSvg: ''}]}, []), /1 pictures but 0 PNGs/);
});

test('the schema check rejects a slide with a wrong element', {skip: !(hasXmllint() && hasXsd())}, () => {
  const slide = '<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="x"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:prstGeom prst="notAShape"><a:avLst/></a:prstGeom></p:spPr></p:sp></p:spTree></p:cSld></p:sld>';
  assert.ok(slideSchemaProblems(slide).length > 0);
});

test('every band type is either native (a function) or an image', () => {
  assert.equal(typeof BAND_HANDLERS.table, 'function');
  assert.equal(BAND_HANDLERS.chart, 'image');
  assert.ok(Object.keys(BAND_HANDLERS).length >= 30);
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
    const measured = fs.existsSync(regular) && fs.existsSync(bold) ? {...config, measure: 'font' as const, fonts: {sans: {regular: `${regular}#1`, bold: `${bold}#1`}, mono: {regular: `${regular}#0`, bold: `${bold}#0`}}} : config;
    const diagram = await loadDiagram(abs, measured);
    const rendered = await renderDiagram(diagram, {name: path.basename(source, '.ts') + '.svg', budget: 'cacheOnly'});
    const opts = {rasterFonts: fontFilesOf(measured.fonts)};
    const a = emitPptx(rendered.laidOut, opts), b = emitPptx(rendered.laidOut, opts);
    assert.deepEqual(a, b);
    const xml = unzipEntry(a, 'ppt/slides/slide1.xml').toString();
    assert.deepEqual(xmlProblems(xml), []);
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => m[1]!);
    assert.equal(new Set(ids).size, ids.length);
    for (const m of xml.matchAll(/<a:(?:stCxn|endCxn) id="(\d+)"/g)) assert.ok(ids.includes(m[1]!));
    if (hasXmllint() && hasXsd()) assert.deepEqual(slideSchemaProblems(xml), []);
    try {
      execFileSync('xmllint', ['--noout', '-'], {input: xml, stdio: ['pipe', 'ignore', 'pipe']});
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  });
});

test.after(async () => { await closeMeasurer(); });
