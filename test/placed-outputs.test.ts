import assert from 'node:assert/strict';
import {test} from 'node:test';
import {areas, box, diagram, renderInBrowser, row, swimlane} from '../lib/web.ts';
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

// ADR 0080 D13: row() and areas() place rows; the swimlane places boxes. Each placed type is checked by its own definition.
test('a figure with both row() and areas() checks contrast per own type', async () => {
  const cells = {a: box({id: 'a', title: 'a', tone: 'accent'}), b: box({id: 'b', title: 'b', tone: 'accent'})};
  const fig = () => diagram({theme: 'blue', tones: lowContrast});
  const render = (d: ReturnType<typeof fig>) => renderInBrowser(d, {measure, nodeIds: true});
  const contrast = (r: Awaited<ReturnType<typeof render>>) => r.verdict.problems.filter((p: unknown) => /low contrast/.test(String(p))).length;
  const nodes = (svg: string) => (svg.match(/data-node=/g) ?? []).length;
  const rowBand = () => row([box({id: 'r1', title: 'r1', tone: 'accent'}), box({id: 'r2', title: 'r2', tone: 'accent'})]);
  const rowOnly = await render(fig().add(rowBand()));
  const areasOnly = await render(fig().add(areas('a b', cells)));
  const both = await render(fig().add(rowBand(), areas('a b', cells)));
  assert.ok(contrast(rowOnly) > 0 && contrast(areasOnly) > 0, JSON.stringify([rowOnly.verdict.problems, areasOnly.verdict.problems]));
  assert.equal(contrast(both), contrast(rowOnly) + contrast(areasOnly));
  assert.equal(nodes(both.svg), nodes(rowOnly.svg) + nodes(areasOnly.svg));
  assert.ok(nodes(both.svg) >= 4);
});

test('emitSvg nodeIds names the boxes of areas and swimlane figures', async () => {
  const figures = {
    areas: diagram({theme: 'blue'}).add(areas('a b', {a: box({title: 'a'}), b: box({title: 'b'})})),
    swimlane: diagram({theme: 'blue'}).add(swimlane(lanes, [...steps])),
  };
  for (const [name, figure] of Object.entries(figures)) {
    const rendered = await renderInBrowser(figure, {measure, nodeIds: true});
    const count = (svg: string) => (svg.match(/data-node=/g) ?? []).length;
    assert.ok(count(rendered.svg) > 0, name);
    assert.equal(count(emitSvg(rendered.laidOut, {nodeIds: true})), count(rendered.svg), name);
  }
});
