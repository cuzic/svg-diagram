// Unglued lines (lib/pptx/line-shapes.ts freeformPathXml): a straight segment or an orthogonal 3-segment elbow is PowerPoint's own connector,
// drawing the same points; anything else is a freeform p:sp with a text body. Never a p:cxnSp with a custom geometry (ADR 0027).
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {register} from 'node:module';
import {freeformPathXml} from '../lib/pptx/line-shapes.ts';
import {presetLine, unglued, type PathStep} from '../lib/pptx/free-line.ts';
import {evalConnector, type Pt} from '../lib/pptx/geom.ts';
import {loadConfig} from '../lib/config.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {renderDiagram} from '../lib/dsl/render.ts';
import {closeMeasurer} from '../lib/measure.ts';
import {planSlide, fontsOf} from '../lib/pptx/slide.ts';
import {EMU} from '../lib/pptx/xml.ts';
import {lineShapeProblems} from './helpers/pptx/lines.ts';

register(new URL('../lib/resolve-hook.ts', import.meta.url)); // the examples import 'svg-diagram'

test.after(() => closeMeasurer());
const steps = (pts: Pt[]): PathStep[] => pts.map((p, i) => ({op: i ? 'L' : 'M', pts: [p]}));
const close = (a: Pt[], b: Pt[]): void => {
  assert.equal(a.length, b.length, JSON.stringify({a, b}));
  a.forEach((p, i) => assert.ok(Math.abs(p.x - (b[i] as Pt).x) < 0.01 && Math.abs(p.y - (b[i] as Pt).y) < 0.01, JSON.stringify({a, b})));
};

test('a 3-segment elbow is a bentConnector3 that draws the same points, in all four directions, V-H-V and H-V-H', () => {
  for (const [sx, ex] of [[100, 400], [400, 100]] as const) for (const [sy, ey] of [[50, 250], [250, 50]] as const) {
    const vhv = [{x: sx, y: sy}, {x: sx, y: sy + (ey - sy) * 0.3}, {x: ex, y: sy + (ey - sy) * 0.3}, {x: ex, y: ey}];
    const hvh = [{x: sx, y: sy}, {x: sx + (ex - sx) * 0.7, y: sy}, {x: sx + (ex - sx) * 0.7, y: ey}, {x: ex, y: ey}];
    for (const [pts, rot] of [[vhv, 5400000], [hvh, 0]] as const) {
      const x = presetLine(steps(pts));
      assert.ok(x, JSON.stringify(pts));
      assert.equal(x.prst, 'bentConnector3');
      assert.equal(x.rot, rot);
      close(evalConnector(x), pts);
    }
  }
});

test('the V-H-V elbow matches PowerPoint\'s own encoding (rot 90deg, the pre-rotation box, flips)', () => {
  // from (300,100) down to y 116, across to (100,116), down to (100,132): rot=5400000, ext = (|E.y-S.y|, |E.x-S.x|) centred between the ends,
  // flipH only when the end is above the start, flipV only when it is right of the start (neither here)
  const x = presetLine(steps([{x: 300, y: 100}, {x: 300, y: 116}, {x: 100, y: 116}, {x: 100, y: 132}]));
  assert.ok(x);
  assert.deepEqual({rot: x.rot, flipH: x.flipH, flipV: x.flipV, adj: x.adj}, {rot: 5400000, flipH: false, flipV: false, adj: [50000]});
  const S = {x: 300, y: 100}, E = {x: 100, y: 132}, extX = Math.abs(E.y - S.y) * EMU, extY = Math.abs(E.x - S.x) * EMU;
  assert.deepEqual([x.extX, x.extY, x.offX, x.offY], [extX, extY, (S.x + E.x) / 2 * EMU - extX / 2, (S.y + E.y) / 2 * EMU - extY / 2]);
});

test('a straight segment is a straightConnector1 in every direction; curves, diagonals, U shapes and longer polylines are not connectors', () => {
  for (const [dx, dy] of [[200, 80], [-200, 80], [200, -80], [-200, -80], [0, 90], [90, 0]] as const) {
    const pts = [{x: 300, y: 300}, {x: 300 + dx, y: 300 + dy}], x = presetLine(steps(pts));
    assert.equal(x?.prst, 'straightConnector1');
    close(evalConnector(x!), pts);
  }
  assert.equal(presetLine([{op: 'M', pts: [{x: 0, y: 0}]}, {op: 'Q', pts: [{x: 10, y: 20}, {x: 30, y: 0}]}]), null, 'a curve');
  assert.equal(presetLine(steps([{x: 0, y: 0}, {x: 10, y: 10}, {x: 20, y: 0}])), null, 'diagonals');
  assert.equal(presetLine(steps([{x: 10, y: 0}, {x: 10, y: 9}, {x: 300, y: 9}, {x: 300, y: 0}])), null, 'a U (a bracket): bentConnector3 cannot draw it exactly');
  assert.equal(presetLine(steps([{x: 0, y: 0}, {x: 0, y: 10}, {x: 10, y: 10}, {x: 10, y: 20}, {x: 20, y: 20}])), null, '4 segments');
  const sp = freeformPathXml(7, 'brace', [{op: 'M', pts: [{x: 0, y: 0}]}, {op: 'Q', pts: [{x: 10, y: 20}, {x: 30, y: 0}]}], '#112233', 2, {arrow: true});
  assert.match(sp, /^<p:sp><p:nvSpPr><p:cNvPr id="7" name="brace"\/><p:cNvSpPr\/><p:nvPr\/><\/p:nvSpPr><p:spPr>.*<a:custGeom>.*fill="none".*<a:tailEnd type="triangle".*<\/p:spPr><p:txBody><a:bodyPr\/><a:lstStyle\/><a:p><a:endParaRPr lang="en-US"\/><\/a:p><\/p:txBody><\/p:sp>$/);
  assert.match(freeformPathXml(8, 'line', steps([{x: 0, y: 0}, {x: 0, y: 10}, {x: 50, y: 10}, {x: 50, y: 20}]), '#112233', 2), /^<p:cxnSp>.*<p:cNvCxnSpPr\/>.*prst="bentConnector3"/);
});

test('unglued keeps the line\'s <a:ln> as given, on a connector or on a freeform shape, and glues nothing', () => {
  const ln = '<a:ln w="9525"><a:solidFill><a:srgbClr val="445566"/></a:solidFill><a:tailEnd type="triangle"/></a:ln>';
  const straight = unglued(3, 'route', steps([{x: 0, y: 0}, {x: 40, y: 30}]), ln);
  assert.match(straight, /^<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="3" name="route"\/><p:cNvCxnSpPr\/><p:nvPr\/><\/p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="0" y="0"\/><a:ext cx="381000" cy="285750"\/><\/a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst><\/a:avLst><\/a:prstGeom>/);
  assert.ok(straight.endsWith(`${ln}</p:spPr></p:cxnSp>`));
  const zigzag = unglued(4, 'route', steps([{x: 0, y: 0}, {x: 10, y: 20}, {x: 20, y: 0}, {x: 30, y: 20}]), ln);
  assert.match(zigzag, /^<p:sp>.*<a:moveTo><a:pt x="0" y="0"\/><\/a:moveTo><a:lnTo><a:pt x="95250" y="190500"\/>.*<\/a:custGeom><a:ln w="9525">.*<p:txBody>/);
  assert.doesNotMatch(straight + zigzag, /stCxn|endCxn/);
});

test('no example\'s slide has a connector with a custom geometry, and every freeform line has a text body', async () => {
  const sources = fs.readdirSync('examples').filter(f => f.endsWith('.ts')).sort().map(f => path.resolve('examples', f));
  const problems: string[] = [];
  for (const abs of sources) {
    const rendered = await renderDiagram(await loadDiagram(abs, loadConfig(path.dirname(abs))), {name: path.basename(abs, '.ts') + '.svg', budget: 'cacheOnly'});
    problems.push(...lineShapeProblems(planSlide(rendered.laidOut, fontsOf()).xml).map(p => `${path.basename(abs)}: ${p}`));
  }
  assert.ok(sources.length > 100);
  assert.deepEqual(problems, []);
});
