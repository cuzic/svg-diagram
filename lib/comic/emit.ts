// The drawing of a comic() band (ADR 0074 D1 / D2 / D4): the panels, the stand-in heads (U2 draws the faces), the bubbles and their tails, the blanks in
// their empty state. The text is not outlined and not measured here: a line is one <text> drawn from its start, and every atom's width came from the layout.
import {escapeXml} from '../emit-common.ts';
import {balloonPath} from './balloon-path.ts';
import {BADGE, COLOR, FONT, FRAME, SLOT_FONT, TAIL_HALF, f1} from './constants.ts';
import type {ComicLaidBubble, ComicLaidPanel, ComicLaidSlot, LaidOutComic} from '../types/comic.ts';

const tintOf = (p: ComicLaidPanel): string => p.tint === 'warm' ? COLOR.warm : p.tint === 'cool' ? COLOR.cool : COLOR.paper;

function panelSvg(p: ComicLaidPanel): string {
  const out = [`<g data-panel="${p.id}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${tintOf(p)}" stroke="${COLOR.ink}" stroke-width="${FRAME}"/>`];
  if (p.label !== undefined) out.push(`<rect x="${p.x - 8}" y="${p.y - 8}" width="${BADGE}" height="${BADGE}" fill="${COLOR.ink}"/><text x="${p.x - 8 + BADGE / 2}" y="${p.y - 8 + 17}" text-anchor="middle" font-size="${SLOT_FONT}" font-weight="700" fill="${COLOR.paper}">${escapeXml(p.label)}</text>`);
  for (const h of p.heads) out.push(`<circle data-head="${h.id}" cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="${COLOR.skin}" stroke="${COLOR.ink}" stroke-width="2.5"/>`);
  out.push('</g>');
  return out.join('');
}

function slotSvg(s: ComicLaidSlot, blank: 'prompt' | 'line'): string {
  const line = `<line x1="${s.x}" y1="${f1(s.y + s.h)}" x2="${f1(s.x + s.w)}" y2="${f1(s.y + s.h)}" stroke="${COLOR.prompt}" stroke-width="2" stroke-dasharray="2 3"/>`;
  const prompt = blank === 'line' ? '' : `<text x="${f1(s.x + s.w / 2)}" y="${f1(s.y + s.h - 5)}" text-anchor="middle" font-size="${SLOT_FONT}" fill="${COLOR.prompt}">${escapeXml(s.prompt)}</text>`;
  return `<g data-slot="${s.id}">${line}${prompt}</g>`;
}

/** The body and the tail are one closed path (lib/comic/balloon-path.ts). */
function outlineSvg(b: ComicLaidBubble): string {
  const {d} = balloonPath(b, b.kind, b.tail ? {tip: b.tail.tip, halfWidth: TAIL_HALF} : undefined);
  const style = b.kind === 'think' ? ' stroke-dasharray="6 3"' : '';
  return `<path d="${d}" fill="${COLOR.bubble}" stroke="${COLOR.ink}" stroke-width="${b.kind === 'shout' ? 3.5 : b.kind === 'narration' ? 2 : 2.5}" stroke-linejoin="round"${style}/>`;
}

const bubbleSvg = (b: ComicLaidBubble, blank: 'prompt' | 'line'): string => `<g data-bubble="${b.id}"><title>${escapeXml(b.title)}</title>${outlineSvg(b)}`
  + b.runs.map(r => `<text x="${r.x}" y="${r.y}" font-size="${FONT}" fill="${COLOR.ink}">${escapeXml(r.text)}</text>`).join('') + b.slots.map(s => slotSvg(s, blank)).join('') + '</g>';

export function renderComicBand(b: LaidOutComic): string {
  return `<g data-comic="${b.layout}"><title>${escapeXml(b.title)}</title>${b.panels.map(panelSvg).join('')}${b.bubbles.map(x => bubbleSvg(x, b.blank)).join('')}</g>`;
}
