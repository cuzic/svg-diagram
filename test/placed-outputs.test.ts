import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {box, diagram, renderInBrowser, swimlane} from '../lib/web.ts';
import {emitSvg} from '../lib/emit.ts';

const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.6, h: size});
const lanes = [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}];
const steps = [{id: 's1', lane: 'a', title: 'hello', tone: 'accent'}, {id: 's2', lane: 'b', title: 'world'}] as const;
const lowContrast = {accent: {fill: '#222222'}};

// ADR 0080 D13: a band laid out as another type (swimlane steps are placed boxes) is checked by its own type's definition.
test('swimlane steps keep the contrast check without a standalone box in the figure', async () => {
  const only = await renderInBrowser(diagram({theme: 'blue', tones: lowContrast}).add(swimlane(lanes, [...steps])), {measure});
  const withBox = await renderInBrowser(diagram({theme: 'blue', tones: lowContrast}).add(box({title: 'x'}), swimlane(lanes, [...steps])), {measure});
  const contrast = (r: typeof only) => r.verdict.problems.filter(p => /low contrast/.test(String(p)));
  assert.ok(contrast(only).length > 0, JSON.stringify(only.verdict.problems));
  assert.equal(contrast(only).length, contrast(withBox).length);
});

test('emitSvg nodeIds names the boxes of areas and swimlane figures', async () => {
  for (const name of ['areas-trace', 'service-blueprint']) {
    const {default: define} = await import(pathToFileURL(new URL(`../examples/${name}.ts`, import.meta.url).pathname).href);
    const rendered = await renderInBrowser(define(), {measure, nodeIds: true} as never);
    const count = (svg: string) => (svg.match(/data-node=/g) ?? []).length;
    assert.ok(count(rendered.svg) > 0, name);
    assert.equal(count(emitSvg(rendered.laidOut, {nodeIds: true})), count(rendered.svg), name);
  }
});
