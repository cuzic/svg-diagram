// One blank drawn in its states (ADR 0074 D4): empty (a dotted underline and the prompt), filled (the value, red and bold), or skipped (the fallback, plain).
import {escapeXml} from '../emit-common.ts';
import {COLOR, FONT, f1, metricsOf} from './constants.ts';
import {slotFontSize} from './slot-values.ts';
import type {slotValue} from './slot-values.ts';
import type {ComicLaidSlot} from '../types/comic.ts';
import type {WidthOf} from '../types/core.ts';

export function slotSvg(s: ComicLaidSlot, blank: 'prompt' | 'line', node: string, value: ReturnType<typeof slotValue>, widthOf?: WidthOf, font: number = FONT): string {
  const group = `<g data-slot="${s.id}"${node}>`;
  const cx = f1(s.x + s.w / 2);
  if (value) {
    const clip = `slot-clip-${s.id}`;
    const size = slotFontSize(s, value, widthOf, font);
    const filled = value.weight === 700;
    return group + `<clipPath id="${clip}"><rect x="${s.x}" y="${f1(s.y - 4)}" width="${s.w}" height="${s.h + 8}"/></clipPath>`
      + `<text x="${cx}" y="${f1(s.y + s.h / 2)}" text-anchor="middle" dominant-baseline="central" xml:space="preserve" font-size="${size}"${filled ? ' font-weight="700"' : ''} fill="${filled ? COLOR.filled : COLOR.prompt}" clip-path="url(#${clip})">${escapeXml(value.text)}</text></g>`;
  }
  const line = `<line x1="${s.x}" y1="${f1(s.y + s.h)}" x2="${f1(s.x + s.w)}" y2="${f1(s.y + s.h)}" stroke="${COLOR.prompt}" stroke-width="2" stroke-dasharray="2 3"/>`;
  const prompt = blank === 'line' ? '' : `<text x="${cx}" y="${f1(s.y + s.h - 5)}" text-anchor="middle" font-size="${metricsOf(font).slotFont}" fill="${COLOR.prompt}">${escapeXml(s.prompt)}</text>`;
  return group + line + prompt + '</g>';
}
