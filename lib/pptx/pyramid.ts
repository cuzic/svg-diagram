import {PALETTE} from '../tokens.ts';
import type {LaidOutPyramid} from '../types/figures.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import {drawAll, polygonHolder} from './fill.ts';
import type {Drawn, Placed} from './fill.ts';
import {nameOf} from './prims.ts';
import {groupXml} from './shapes.ts';
import type {Fonts} from './xml.ts';

/** A pyramid: each layer a trapezoid in the accent colour at its opacity, holding its lines. */
export function pyramidXml(b: LaidOutPyramid, ld: LaidOutDiagram, fonts: Fonts, next: () => number): string {
  const accent = PALETTE[b.day].accent, drawn: Drawn[] = [], texts: Placed[] = [];
  for (const layer of b.layers) {
    const id = next();
    drawn.push(polygonHolder(id, () => nameOf('layer', id, layer.lines.join('')), layer.points.map(([x, y]) => ({x, y})), {fill: accent, fillOpacity: layer.opacity, stroke: accent, widthPx: 2.5}));
    layer.lines.forEach((line, i) => texts.push({t: {text: line, x: layer.cx, y: layer.textYs[i] ?? 0, anchor: 'middle', size: ld.roles.title, bold: true, color: layer.textColor}}));
  }
  return groupXml(next(), 'pyramid', b, drawAll(drawn, texts, fonts, next));
}
