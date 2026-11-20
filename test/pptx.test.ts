import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {register} from 'node:module';
import test from 'node:test';
import {fitConnector, evalConnector, maxDeviation, type Pt} from '../lib/pptx/geom.ts';
import {zipStore} from '../lib/pptx/zip-node.ts';
import {crc32, zipEntries} from '../lib/pptx/zip.ts';
import {crc32 as zlibCrc32} from 'node:zlib';
import {emitPptx, fontFilesOf} from '../lib/pptx/emit.ts';
import {BAND_HANDLERS} from '../lib/pptx/bands.ts';
import {chartTableXml} from '../lib/pptx/table.ts';
import {boundaryChips, swimlaneTable} from '../lib/pptx/swimlane.ts';
import {bpmnMarks, bpmnTable, ganttMarks, ganttTable} from '../lib/pptx/frame-tables.ts';
import {ROLES} from '../lib/tokens.ts';
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
  // a chart is native when it is a table (harvey, compare, heatmap), else drawn from its SVG
  assert.equal(typeof BAND_HANDLERS.chart, 'function');
  assert.ok(Object.keys(BAND_HANDLERS).length >= 30);
});

test('chartTableXml: a chart table as a PowerPoint table, each cell with its own fill, sides and anchor', () => {
  const xml = chartTableXml(7, 'heatmap', {x: 10, y: 20, colW: [40, 30, 30], rowH: [20, 24], size: 14, pitch: 18, cells: [
    [{lines: ['角'], align: 'start', valign: 'bottom', padX: 4, padY: 8, ink: 'muted'}, {lines: ['見出し'], align: 'middle', valign: 'middle', ink: 'text', bold: true, span: 2}, null],
    [{lines: ['行', '2行目'], align: 'start', valign: 'middle', ink: 'text', r: {stroke: 'border', sw: 2}},
      {lines: ['50%'], align: 'middle', valign: 'middle', ink: 'bg', fill: {key: 'accent', op: 0.5}, l: {stroke: 'bg', sw: 2}},
      {lines: [], align: 'middle', valign: 'middle', ink: 'muted', t: {stroke: 'border', sw: 2, dash: '3,3'}}],
  ]}, 1, {sans: 'S', mono: 'M'});
  assert.deepEqual(xmlProblems(xml), []);
  assert.match(xml, /^<p:graphicFrame>.*<p:cNvPr id="7" name="heatmap"\/>.*<a:off x="95250" y="190500"\/><a:ext cx="952500" cy="419100"\/>/);
  assert.equal([...xml.matchAll(/<a:gridCol /g)].length, 3);
  assert.match(xml, /<a:tc gridSpan="2">.*?<a:t>見出し<\/a:t>.*?<\/a:tc><a:tc hMerge="1">/);
  // the bottom-anchored corner: its inset less the line's descent below the baseline (0.2 of the pitch)
  assert.match(xml, /<a:t>角<\/a:t>.*?<a:tcPr marL="38100" marR="19050" marT="0" marB="41910" anchor="b">/);
  assert.match(xml, /<a:t>行<\/a:t><\/a:r><a:br\/>.*?<a:t>2行目<\/a:t>/);
  assert.match(xml, /<a:t>50%<\/a:t>.*?<a:srgbClr val="[0-9A-F]{6}"><a:alpha val="50000"\/><\/a:srgbClr><\/a:solidFill><\/a:tcPr>/);
  assert.match(xml, /<a:lnT w="19050"[^>]*>.*?<a:prstDash val="dash"\/>/);
  // a side with no rule and a cell with no fill say so, so no table style shows through
  assert.match(xml, /<a:lnL w="0"><a:noFill\/><\/a:lnL>/);
  assert.match(xml, /<a:noFill\/><\/a:tcPr>/);
  assert.match(xml, /<a:endParaRPr lang="ja-JP"\/><\/a:p>/);
});

test('swimlaneTable: the label column, body columns cut at the phases, a row per lane; boundaryChips: a chip per named boundary', () => {
  const lane = (y: number, h: number, label: string, tone?: 'accent') => ({y, h, labelLines: [label], labelTop: y + 10, maxStep: 40, blockTop: y + 8, ...(tone ? {tone} : {})});
  const b = {type: 'swimlane' as const, x: 0, y: 0, w: 500, h: 230, labelW: 100, bodyX: 100, phaseH: 30,
    phases: [{x: 110, w: 200, lines: ['前']}, {x: 310, w: 190, lines: ['後']}],
    lanes: [lane(30, 100, 'A'), lane(130, 100, 'B', 'accent')], boundaries: [{y: 130, label: '境'}, {y: 130}]};
  const t = swimlaneTable(b, ROLES);
  // body edges 100 | 110 | 310 | 500: an unnamed sliver before the first phase, then the two phases
  assert.deepEqual(t.colW, [100, 10, 200, 190]);
  assert.deepEqual(t.rowH, [30, 100, 100]);
  const [head, a, bRow] = t.cells;
  assert.deepEqual(head?.map(c => c?.lines.join('') ?? null), ['', '', '前', '後']);
  // a lane's body spans every body column; the accent lane's label is soft and accent
  assert.equal(a?.[1]?.span, 3);
  assert.deepEqual([bRow?.[0]?.fill, bRow?.[0]?.ink], [{key: 'soft'}, 'accent']);
  // the boundary is the dashed rule between the two lanes
  assert.equal(a?.[1]?.b?.dash, '10,6');
  assert.equal(bRow?.[0]?.t?.dash, '10,6');
  assert.deepEqual(boundaryChips(b, ROLES).map(c => c.label), ['境']);
});

test('ganttTable: a column per stretch between ticks, a row per task or section; ganttMarks: the chart without its frame', () => {
  const text = (t: string, x: number, y: number, anchor: 'start' | 'middle', bold = false) => ({text: t, x, y, size: 14, bold, muted: false, anchor});
  const b = {type: 'gantt' as const, x: 0, y: 0, w: 400, h: 108, plot: {x1: 80, x2: 380, y1: 36, y2: 100}, ticks: [{x: 80}, {x: 230}],
    rows: [{y: 36, h: 32}, {y: 68, h: 32}], sections: [{x: 0, y: 36, w: 400, h: 32}], bars: [{x: 90, y: 75, w: 100, h: 18, label: 'T', tone: 'accent' as const}], actuals: [], deps: [],
    texts: [text('11/3', 80, 16, 'middle'), text('S', 8, 56, 'start', true), text('T', 8, 88, 'start')], anchors: [], labelBoxes: []};
  const t = ganttTable(b, ROLES);
  // edges 0 | 80 | 230 | 380 | 400: the tick at the plot's left is its edge, the one at 230 a rule
  assert.deepEqual(t.colW, [80, 150, 150, 20]);
  assert.deepEqual(t.rowH, [36, 32, 32, 8]);
  const [head, sec, task] = t.cells;
  assert.deepEqual(head?.map(c => !!c?.b), [false, true, true, false]);
  assert.deepEqual([sec?.[0]?.lines, sec?.[0]?.bold, sec?.[3]?.fill], [['S'], true, {key: 'code'}]);
  assert.deepEqual([task?.[0]?.lines, task?.[0]?.fill, task?.[2]?.l?.stroke, task?.[1]?.r?.stroke, task?.[3]?.l], [['T'], undefined, 'border', 'border', undefined]);
  const m = ganttMarks(b);
  assert.deepEqual([m.frame, m.sections, m.ticks, m.texts.map(x => x.text)], [false, [], [], ['11/3']]);
  // rows of their own heights (a task with a plan and an actual lane is taller: ADR 0068 D4b); the legend strip goes in the padding row
  const two = {...b, h: 140, plot: {...b.plot, y2: 112}, rows: [{y: 36, h: 32}, {y: 68, h: 44}], texts: [text('11/3', 80, 16, 'middle'), text('S', 8, 56, 'start', true), text('T', 8, 94, 'start')]};
  const t2 = ganttTable(two, ROLES);
  assert.deepEqual(t2.rowH, [36, 32, 44, 28]);
  assert.deepEqual(t2.cells[2]?.[0]?.lines, ['T']);
});

test('bpmnTable: a row per lane (a column, vertical) with its name cell; bpmnMarks: the figure without lanes; lanes with a gap make no table', () => {
  const text = (t: string, x: number, y: number, bold: boolean) => ({text: t, x, y, size: 14, bold, muted: false, anchor: 'middle' as const});
  const lane = (x: number, y: number, w: number, h: number, tone: 'plain' | 'accent', v = false) => ({x, y, w, h, labelW: v ? 0 : 100, ...(v ? {labelH: 40} : {}), tone});
  const base = {type: 'bpmn' as const, x: 0, y: 0, w: 500, h: 200, nodes: [], icons: [], edges: [], labels: [], anchors: [], labelBoxes: []};
  const h = {...base, lanes: [lane(0, 0, 500, 100, 'plain'), lane(0, 100, 500, 100, 'accent')], texts: [text('A', 50, 55, true), text('B', 50, 155, true), text('作業', 300, 55, true)]};
  const t = bpmnTable(h, ROLES, NO_TONES, 1);
  assert.deepEqual([t?.colW, t?.rowH], [[100, 400], [100, 100]]);
  assert.deepEqual(t?.cells.map(r => r.map(c => c?.lines.join(''))), [['A', ''], ['B', '']]);
  assert.deepEqual(t?.cells[0]?.[1]?.fill, {key: 'bg'});
  assert.notDeepEqual(t?.cells[1]?.[1]?.fill, {key: 'bg'});
  assert.deepEqual(bpmnMarks(h).texts.map(x => x.text), ['作業']);
  assert.deepEqual(bpmnMarks(h).lanes, []);
  const v = {...base, dir: 'v' as const, lanes: [lane(0, 0, 250, 200, 'plain', true), lane(250, 0, 250, 200, 'plain', true)], texts: [text('A', 125, 25, true), text('B', 375, 25, true)]};
  const tv = bpmnTable(v, ROLES, NO_TONES, 1);
  assert.deepEqual([tv?.colW, tv?.rowH, tv?.cells[0]?.map(c => c?.lines.join(''))], [[250, 250], [40, 160], ['A', 'B']]);
  assert.equal(bpmnTable({...h, lanes: [lane(0, 0, 500, 90, 'plain'), lane(0, 100, 500, 100, 'plain')]}, ROLES, NO_TONES, 1), undefined);
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
