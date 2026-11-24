import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {register} from 'node:module';
import test from 'node:test';
import {pyramidPptx} from '../lib/pptx/pyramid-band.ts';
import {timelinePptx} from '../lib/pptx/timeline-band.ts';
import {flowPptx} from '../lib/pptx/flow-band.ts';
import {pyramid as selectedPyramid} from '../lib/bands/pyramid.ts';
import {timeline as selectedTimeline} from '../lib/bands/timeline.ts';
import {chevron as selectedChevron} from '../lib/bands/chevron.ts';
import {groupSpan} from '../lib/pptx/group-span.ts';
import {groupPptx} from '../lib/pptx/box-bands.ts';
import {group as selectedGroup} from '../lib/bands/group.ts';
import {tablePptx} from '../lib/pptx/table-band.ts';
import {table as selectedTable} from '../lib/bands/table.ts';
import {renderBandsPptx} from '../lib/pptx/selective.ts';
import {boxPptx, rowPptx} from '../lib/pptx/box-bands.ts';
import {box as selectedBox} from '../lib/bands/box.ts';
import {row as selectedRow} from '../lib/bands/row.ts';
import {raw as selectedRaw} from '../lib/bands/raw.ts';
import {fitConnector, evalConnector, maxDeviation, type Pt} from '../lib/pptx/geom.ts';
import {zipStore} from '../lib/pptx/zip-node.ts';
import {crc32, zipEntries} from '../lib/pptx/zip.ts';
import {crc32 as zlibCrc32} from 'node:zlib';
import {emitPptx, fontFilesOf} from '../lib/pptx/emit.ts';
import {BAND_HANDLERS} from '../lib/pptx/bands.ts';
import {groupFrameXml} from '../lib/pptx/shapes.ts';
import {NO_TONES} from '../lib/tokens.ts';
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
  const xml = groupFrameXml(2, 'a"b&c', {x: 0, y: 0, w: 0, h: 40}, undefined, undefined, 1, NO_TONES);
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
  const types = new TextDecoder().decode(packageEntries({xml: '<x/>', cx: 1, cy: 1, pictures: []}, []).find(e => e.name === '[Content_Types].xml')!.data);
  assert.match(types, /Extension="png"/);
  assert.match(types, /Extension="svg"/);
  assert.throws(() => packageEntries({xml: '<x/>', cx: 1, cy: 1, pictures: [{svg: '', pngSvg: ''}]}, []), /1 pictures but 0 PNGs/);
});

test('lib/pptx/template.ts is the template folder as it is (run scripts/gen-pptx-template.ts after changing a file there)', async () => {
  const {TEMPLATE} = await import('../lib/pptx/template.ts');
  const dir = new URL('../lib/pptx/template/', import.meta.url);
  const files = (fs.readdirSync(dir, {recursive: true, withFileTypes: true}) as fs.Dirent[]).filter(e => e.isFile()).map(e => path.relative(dir.pathname, path.join(e.parentPath, e.name))).sort();
  assert.deepEqual(TEMPLATE.map(t => t.name), files);
  for (const t of TEMPLATE) assert.equal(t.text, fs.readFileSync(new URL(t.name, dir), 'utf8'), t.name);
});

test('the zip writer\'s own crc32 is zlib\'s, and an entry is stored when deflating does not make it smaller', () => {
  for (const s of ['', 'a', '<p:sld/>'.repeat(300)]) assert.equal(crc32(new TextEncoder().encode(s)), zlibCrc32(s));
  const data = new Uint8Array([1, 2, 3]);
  const zip = zipEntries([{name: 'x', data, deflated: new Uint8Array(10)}]);
  assert.equal(new DataView(zip.buffer).getUint16(8, true), 0);
  assert.deepEqual([...zip.subarray(31, 34)], [1, 2, 3]);
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

test('selected PPTX adapters preserve editable shapes and report picture fallbacks', async () => {
  const native = [selectedRow([selectedBox({title: 'Review'}), selectedBox({title: 'Done'})]), selectedBox({title: 'Finish'})];
  const raw = selectedRaw({h: 40, draw: ({x, y}) => `<rect x="${x}" y="${y}" width="24" height="24"/>`});
  const opts = {
    measure: ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size}),
    bands: {box: boxPptx, row: rowPptx},
  };
  const result = await renderBandsPptx(native, {...opts, strict: true});
  const slide = unzipEntry(Buffer.from(result.pptx), 'ppt/slides/slide1.xml')!.toString('utf8');
  assert.match(slide, /<p:grpSp>[\s\S]*<p:sp>[\s\S]*>Review<\/a:t>/);
  assert.doesNotMatch(slide, /<p:pic>/);
  assert.deepEqual(result.fallbacks, []);
  const beforeReveal = await renderBandsPptx([
    selectedRow([selectedBox({title: 'Visible'}), selectedBox({title: 'Hidden', reveal: 2})], {arrows: 'between'}),
  ], {...opts, stage: 1});
  const earlySlide = unzipEntry(Buffer.from(beforeReveal.pptx), 'ppt/slides/slide1.xml').toString();
  assert.match(earlySlide, />Visible<\/a:t>/);
  assert.doesNotMatch(earlySlide, /Hidden|row-arrow/);

  await assert.rejects(renderBandsPptx([...native, raw], {...opts, strict: true}), /raw/);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=', 'base64');
  const withFallback = await renderBandsPptx([...native, raw], {...opts, bands: {...opts.bands, raw: () => undefined}, rasterize(svg, scale) {
    assert.match(svg, /<rect[^>]+width="24"/);
    assert.equal(scale, 2);
    return png;
  }});
  assert.deepEqual(withFallback.fallbacks, [{type: 'raw'}]);
  assert.deepEqual(unzipEntry(Buffer.from(withFallback.pptx), 'ppt/media/image1.png'), png);
  assert.match(unzipEntry(Buffer.from(withFallback.pptx), 'ppt/media/image1.svg')!.toString(), /<rect[^>]+width="24"/);
});

test('selective PPTX can embed a native editable table independently', async () => {
  const {pptx, fallbacks} = await renderBandsPptx([selectedTable([{label: 'Review'}], [['Done']])], {
    measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
    bands: {table: tablePptx}, strict: true,
  });
  const xml = unzipEntry(Buffer.from(pptx), 'ppt/slides/slide1.xml').toString();
  assert.match(xml, /<a:tbl>[\s\S]*>Done<\/a:t>/);
  assert.deepEqual(fallbacks, []);
});

test('selective PPTX groups nested bands only when a span adapter is supplied', async () => {
  const input = [selectedGroup(selectedGroup(selectedBox({title: 'Nested'}))), selectedBox({title: 'Outside'})];
  const opts = {
    measure: ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size}),
    bands: {group: groupPptx, box: boxPptx},
  };
  const plain = await renderBandsPptx(input, opts);
  const grouped = await renderBandsPptx(input, {...opts, spans: {group: groupSpan}});
  const slide = (bytes: Uint8Array) => unzipEntry(Buffer.from(bytes), 'ppt/slides/slide1.xml').toString();
  await assert.rejects(renderBandsPptx(input, {...opts, spans: {group: () => ({xml: '', count: -1})}}), /span must cover/);
  assert.doesNotMatch(slide(plain.pptx), /<p:grpSp>/);
  assert.equal([...slide(grouped.pptx).matchAll(/<p:grpSp>/g)].length, 2);
  assert.match(slide(grouped.pptx), />Nested<\/a:t>[\s\S]*<\/p:grpSp><\/p:grpSp>[\s\S]*>Outside<\/a:t>/);
});

test('selective PPTX composes separate flow, pyramid and timeline renderers', async () => {
  const result = await renderBandsPptx([
    selectedChevron([{label: 'Review'}, {label: 'Decide'}]),
    selectedPyramid(['Layers', 'Base']),
    selectedTimeline({unit: 'ms', from: 0, to: 100, events: [{at: 25, label: 'Finish'}]}),
  ], {
    measure: ({text, size}) => ({w: [...text].length * size * 0.6, h: size}),
    bands: {chevron: flowPptx, pyramid: pyramidPptx, timeline: timelinePptx}, strict: true,
  });
  const xml = unzipEntry(Buffer.from(result.pptx), 'ppt/slides/slide1.xml').toString();
  assert.match(xml, />Review<\/a:t>[\s\S]*>Layers<\/a:t>[\s\S]*>Finish<\/a:t>/);
  assert.doesNotMatch(xml, /<p:pic>/);
  assert.deepEqual(result.fallbacks, []);
});
