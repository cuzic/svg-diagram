import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {connectorSvgDefs, renderConnect} from '../lib/emit-connect.ts';
import {renderBand} from '../lib/emit-handlers.ts';
import {emitSvgWith} from '../lib/emit-svg-core.ts';
import {emitSvg} from '../lib/emit.ts';
import {diagramTitle, diagramDesc} from '../lib/rules.ts';
import {spotlightDim} from '../lib/spotlight.ts';
import {box, connect, diagram, renderInBrowser, row} from '../lib/web.ts';

test('the shared SVG emitter bundles without legacy band emitters or rules', async () => {
  const {metafile} = await build({entryPoints: [fileURLToPath(new URL('../lib/emit-svg-core.ts', import.meta.url))],
    bundle: true, platform: 'browser', write: false, metafile: true});
  const forbidden = ['/emit-handlers.ts', '/emit-boxes.ts', '/emit-connect.ts', '/rules.ts', '/emit-node-ids.ts', '/spotlight.ts', '/reveal.ts'];
  const found = Object.keys(metafile.inputs).filter(file => forbidden.some(suffix => file.endsWith(suffix)));
  assert.deepEqual(found, []);
});

test('the shared emitter preserves legacy SVG for rows, labelled connectors and dark styling', async () => {
  const data = diagram({theme: 'blue', title: 'Plan', legend: false, appearance: 'auto'})
    .add(row([box({id: 'one', title: 'One'}), box({id: 'two', title: 'Two', body: 'Review', bodyMono: true})], {gap: 48}))
    .add(connect('one:right', 'two:left', {label: 'go', route: 'straight', tone: 'accent'}));
  const {laidOut, svg} = await renderInBrowser(data, {measure: ({text, size}) => ({w: text.length * size / 2, h: size})});
  const seen: string[] = [];
  const actual = emitSvgWith({renderBand: (...args) => {
    seen.push(args[0].type);
    return renderBand(...args);
  }, defsNeeded: band => ({mono: band.type === 'row'}), renderConnect, connectorDefs: connectorSvgDefs, diagramTitle, diagramDesc, spotlightDim}, laidOut);
  assert.equal(actual, emitSvg(laidOut));
  assert.equal(actual, svg);
  assert.deepEqual(seen, ['row']);
  assert.match(actual, /id="dsl-arrow-accent"/);
  assert.match(actual, /marker-end="url\(#dsl-arrow-accent\)"/);
  assert.match(actual, /prefers-color-scheme/);
  assert.match(actual, /\.mono/);
});
