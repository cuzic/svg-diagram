import { PALETTE } from '../tokens.js';
import { drawAll, polygonHolder } from './fill.js';
import { nameOf } from './prims.js';
import { groupXml } from './shapes.js';
/** A pyramid: each layer a trapezoid in the accent colour at its opacity, holding its lines. */
export function pyramidXml(b, ld, fonts, next) {
    const accent = PALETTE[b.day].accent, drawn = [], texts = [];
    for (const layer of b.layers) {
        const id = next();
        drawn.push(polygonHolder(id, () => nameOf('layer', id, layer.lines.join('')), layer.points.map(([x, y]) => ({ x, y })), { fill: accent, fillOpacity: layer.opacity, stroke: accent, widthPx: 2.5 }));
        layer.lines.forEach((line, i) => texts.push({ t: { text: line, x: layer.cx, y: layer.textYs[i] ?? 0, anchor: 'middle', size: ld.roles.title, bold: true, color: layer.textColor } }));
    }
    return groupXml(next(), 'pyramid', b, drawAll(drawn, texts, fonts, next));
}
