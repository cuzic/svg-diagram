import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderSpec, partCatalog, specSchemaFor, validateSpec} from '../lib/spec-selective.ts';
import {flowchartPart} from '../lib/spec-parts/selective/flowchart.ts';
import {funnelPart} from '../lib/spec-parts/selective/funnel.ts';
import {pyramidPart} from '../lib/spec-parts/selective/pyramid.ts';
import {partCatalog as legacyCatalog, specToDiagram} from '../lib/spec.ts';
import {renderInBrowser} from '../lib/web.ts';

test('selected parts reuse legacy schemas and draw without the full spec registry', async () => {
  const parts = [flowchartPart, pyramidPart, funnelPart];
  assert.deepEqual(partCatalog({parts}), legacyCatalog().filter(part => parts.some(p => part.type === p.type)));
  assert.equal(specSchemaFor({parts}).properties?.['parts']?.items?.oneOf?.length, 3);
  const input = {version: 1, title: 'Plan', legend: false, parts: parts.map(part => part.example)};
  const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
  const actual = await renderSpec(input, {measure, parts});
  const old = await renderInBrowser(specToDiagram(input), {measure});
  const body = (svg: string) => svg.slice(svg.indexOf('  <style>'));
  assert.deepEqual(actual.xml, []);
  assert.equal(body(actual.svg), body(old.svg));
  assert.match(validateSpec({...input, parts: [funnelPart.example]}, {parts: [pyramidPart]})[0]!.message, /pyramid.*funnel/);
  assert.equal(validateSpec({...input, canvas: {}}, {parts})[0]!.path, 'canvas');
  const dup = validateSpec({...input, parts: [flowchartPart.example, flowchartPart.example]}, {parts});
  assert.equal(dup[0]!.path, 'parts[1].nodes[0].id');
});

test('the selected schema rejects duplicates and validation keywords it cannot enforce', () => {
  assert.throws(() => specSchemaFor({parts: [funnelPart, funnelPart]}), /duplicate part "funnel"/);
  const properties = {...pyramidPart.schema.properties, caption: {type: 'string' as const, pattern: '^a$'}};
  assert.throws(() => specSchemaFor({parts: [{...pyramidPart, schema: {...pyramidPart.schema, properties}}]}),
    /unsupported schema keyword "pattern" at pyramid.properties.caption/);
});
