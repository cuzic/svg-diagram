// A "reference external plugin" in miniature (ADR 0080): one new band, `rating-demo:stars` (n of max stars, with a label), written
// only against the plugin API (host.ts), with no import from lib/. Neutral example data.
import {definePlugin, type BandKind, type PluginAnchor} from './host.ts';

interface StarsData {label: string; value: number; max: number}
interface StarsLaid extends StarsData {size: number; gap: number; labelW: number; stars: PluginAnchor[]}

const star = (cx: number, cy: number, r: number): string => {
  const pts = Array.from({length: 10}, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * 0.45; return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`; });
  return pts.join(' ');
};

const stars: BandKind<StarsData, StarsLaid> = {
  description: 'A row of stars: value of max, with a label on the left.',
  schema: {type: 'object', properties: {type: {const: 'rating-demo:stars'}, label: {type: 'string', maxLength: 40}, value: {type: 'integer', minimum: 0, maximum: 10}, max: {type: 'integer', minimum: 1, maximum: 10}, id: {type: 'string'}}, required: ['type', 'label', 'value']},
  example: {label: '使いやすさ', value: 4, max: 5},
  build(input) {
    const i = input as Partial<StarsData>;
    if (typeof i.label !== 'string' || !i.label.trim()) throw new Error('rating-demo:stars: label is the name of what is rated');
    const max = i.max ?? 5;
    if (!Number.isInteger(max) || max < 1 || max > 10) throw new Error('rating-demo:stars: max is a whole number 1-10');
    if (!Number.isInteger(i.value) || (i.value as number) < 0) throw new Error('rating-demo:stars: value is a whole number >= 0');
    return {label: i.label, value: i.value as number, max};
  },
  layout(d, env) {
    const size = 24, gap = 4, labelW = 160, h = 40, stars: PluginAnchor[] = [];
    for (let k = 0; k < d.max; k++) stars.push({id: `s${k + 1}`, x: env.x + labelW + k * (size + gap), y: env.y + (h - size) / 2, w: size, h: size});
    // a narrow band that cannot hold the stars: the height grows (a second row would need a layout hook; this keeps it honest)
    return {h, anchors: stars, laid: {...d, size, gap, labelW, stars}};
  },
  emit(l, env) {
    const dark = '#555', fill = env.theme === 'amber' ? '#d98e04' : '#e0a800';
    const cells = l.stars.map((s, k) => `<polygon points="${star(s.x + s.w / 2, s.y + s.h / 2, s.w / 2)}" fill="${k < l.value ? fill : 'none'}" stroke="${dark}" stroke-width="1.5" data-plugin-star="${k + 1}"/>`).join('');
    return `<g data-plugin="rating-demo:stars">${cells}</g>`;
  },
  verify(l, env) {
    const out = [];
    if (l.value > l.max) out.push({rule: 'value-over-max', severity: 'problem' as const, message: `value ${l.value} is more than max ${l.max}`});
    if (l.labelW + l.max * (l.size + l.gap) > env.w) out.push({rule: 'stars-wider-than-band', severity: 'warning' as const, message: `the ${l.max} stars need ${l.labelW + l.max * (l.size + l.gap)}px; the band is ${env.w}px wide`});
    return out;
  },
  rules: {'value-over-max': 'value is more than max', 'stars-wider-than-band': 'the stars do not fit the band width'},
};

export const ratingPlugin = definePlugin({id: 'rating-demo', apiVersion: '1.0.0', bands: {stars}});
