import {readFileSync, writeFileSync} from 'node:fs';
import {escapeAttr} from '../../lib/emit-common.ts';
import type {ComicExpression} from '../../lib/types/comic.ts';

const sourceUrl = new URL('./source/open-peeps.json', import.meta.url);
const outputUrl = new URL('./character.json', import.meta.url);

const faceVariants = {
  neutral: 'serious',
  smile: 'smile',
  laugh: 'smileLOL',
  surprise: 'awe',
  worry: 'concerned',
  angry: 'veryAngry',
  sad: 'solemn',
} satisfies Partial<Record<ComicExpression, string>>;

const recolor = {skin: '#edb98a', hair: '#4a312c', top: '#8fa7df'};
const palette = {skin: recolor.skin, headContrast: recolor.hair, clothing: recolor.top, ink: '#000000'};
type Paint = string | {type: 'color'; name: keyof typeof palette};
type Path = {
  type: 'element';
  name: 'path';
  attributes: {d: string; fill: Paint; 'fill-rule': 'evenodd'; 'clip-rule': 'evenodd'};
};
type Part = {type: 'component'; name: string; attributes: {transform: string}};
type Styles = {variants: Record<string, {elements: Path[]}>};
type Source = {
  canvas: {width: number; elements: (Path | Part)[]};
  components: {head: Styles; expression: Styles};
  meta: {creator: {name: string}; source: {url: string}};
};

function renderPath(path: Path): string {
  const {d, fill, 'fill-rule': fillRule, 'clip-rule': clipRule} = path.attributes;
  const paint = typeof fill === 'string' ? fill : palette[fill.name];
  return `<path d="${escapeAttr(d)}" fill="${paint}" fill-rule="${fillRule}" clip-rule="${clipRule}"/>`;
}

export function convertOpenPeeps() {
  const source: Source = JSON.parse(readFileSync(sourceUrl, 'utf8'));
  const {width, elements} = source.canvas;
  const expressions: Partial<Record<ComicExpression, string>> = {};
  for (const expression of Object.keys(faceVariants) as (keyof typeof faceVariants)[]) {
    const parts = {head: 'bangs', expression: faceVariants[expression]};
    expressions[expression] = elements.map(element => {
      if (element.type === 'element') return renderPath(element);
      const {name, attributes: {transform}} = element;
      if (name !== 'head' && name !== 'expression') return '';
      const part = source.components[name].variants[parts[name]];
      if (!part) throw new Error(`Open Peeps の部品 ${name}/${parts[name]} を元の定義で確認してください`);
      return `<g transform="${escapeAttr(transform)}">${part.elements.map(renderPath).join('')}</g>`;
    }).join('');
  }
  return {
    id: 'open-peeps-bangs',
    name: '案内役',
    // Keep enough of the source's torso for the panel to clip it at its frame.
    box: [0, 0, width, 860],
    anchors: {head: {cx: 377, cy: 347, r: 230}, mouth: [470, 485]},
    expressions,
    license: {spdx: 'CC0-1.0', author: source.meta.creator.name, url: source.meta.source.url},
    recolor,
  } as const;
}

if (import.meta.main) writeFileSync(outputUrl, JSON.stringify(convertOpenPeeps(), null, 2) + '\n');
