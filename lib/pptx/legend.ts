// A legend band as native shapes: each item's sample (a box of a tone or a cause-tree role, a hexagon, a line with its heads, an AND, a
// return, a cutting arrow) and its label as a text box. A legend with fault-tree symbols or a double line stays a picture (legendNative).
import {PALETTE, STRONG_STROKE, type ToneEnv} from '../tokens.ts';
import {resolveBoxStyle} from '../emit-common.ts';
import {LEGEND_SWATCH_W} from '../layout-util.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutLegend} from '../types/containers.ts';
import {freeformPathXml} from './connectors.ts';
import {groupXml} from './shapes.ts';
import {lineXml, namedAs, nameOf, polygonXml, presetXml, textLineXml, type Paint} from './prims.ts';
import type {Fonts} from './xml.ts';

/** Whether every item has a native sample (fault-tree symbols and the double line do not yet). */
export const legendNative = (b: LaidOutLegend): boolean => b.items.every(it => !it.ftaEvent && !it.ftaGate && it.line !== 'double');

export function legendXml(b: LaidOutLegend, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): string {
  const all: string[] = [];
  const text = PALETTE.text;
  for (const it of b.items) {
    // an entry: its sample and its label are one part, in the legend's group (ADR 0054)
    const out: string[] = [];
    const cy = it.y + 12, x0 = it.x, x1 = it.x + LEGEND_SWATCH_W;
    const box = (tone: string | undefined, dashed: boolean | undefined, strokePx: number): Paint => {
      const st = resolveBoxStyle(tones, (tone ?? 'plain') as never, ld.day, dashed);
      return {fill: st.fill, stroke: st.stroke, widthPx: strokePx, dashed: st.dashed};
    };
    if (it.swatch || it.mark) {
      const x = it.x + 4, y = cy - 8, paint = box(it.swatch?.tone, it.swatch?.dashed, it.mark ? 3.5 : 2.5);
      if (it.swatch?.hex) out.push(polygonXml(next(), 'legend-hex', [{x: x + 6, y}, {x: x + 22, y}, {x: x + 28, y: cy}, {x: x + 22, y: y + 16}, {x: x + 6, y: y + 16}, {x, y: cy}], {...paint, widthPx: 2}));
      else {
        out.push(presetXml(next(), 'legend-box', 'roundRect', {x, y, w: 28, h: 16}, paint, 4 / 16 * 100000));
        if (it.swatch?.double) out.push(presetXml(next(), 'legend-inner', 'roundRect', {x: x + 3, y: y + 3, w: 22, h: 10}, {...paint, widthPx: 1.5}, 2 / 10 * 100000));
      }
    } else if (it.edge === 'and') {
      for (const dy of [-5, 5]) out.push(lineXml(next(), 'legend-and', {x: x0, y: cy + dy}, {x: x1, y: cy + dy}, text, 2, {arrow: true}));
      out.push(freeformPathXml(next(), 'legend-and-arc', [{op: 'M', pts: [{x: x0 + 14, y: cy - 5}]}, {op: 'Q', pts: [{x: x0 + 20, y: cy}, {x: x0 + 14, y: cy + 5}]}], text, 2));
    } else if (it.edge === 'back') {
      out.push(lineXml(next(), 'legend-back', {x: x0, y: cy}, {x: x1, y: cy}, text, 3, {arrow: true}));
    } else if (it.edge === 'blocks') {
      out.push(lineXml(next(), 'legend-blocks', {x: x0, y: cy}, {x: x1 - 3, y: cy}, text, 2, {dashed: true}));
      out.push(lineXml(next(), 'legend-bar', {x: x1 - 3, y: cy - 10}, {x: x1 - 3, y: cy + 10}, text, 3));
    } else if (it.line) {
      const strong = it.weight === 'strong';
      out.push(lineXml(next(), 'legend-line', {x: x0, y: cy}, {x: x1, y: cy}, text, strong ? STRONG_STROKE : 2, {dashed: it.line === 'dashed', dotted: it.line === 'dotted', heads: it.arrow ?? 'end'}));
    } else {
      out.push(presetXml(next(), 'legend-box', 'roundRect', {x: it.x + 4, y: cy - 8, w: 28, h: 16}, box(it.tone, it.dashed, 2.5), 4 / 16 * 100000));
    }
    const id = next();
    out.push(textLineXml(id, nameOf('text', id, it.label), {text: it.label, x: x1 + 8, y: cy + 5, anchor: 'start', size: ld.roles.note, bold: false, color: text}, fonts));
    all.push(groupXml(next(), namedAs('entry', it.label), {x: it.x, y: it.y, w: it.w, h: 24}, out.join('')));
  }
  return groupXml(next(), 'legend', b, all.join(''));
}
