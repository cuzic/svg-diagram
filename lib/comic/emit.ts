// The drawing of a comic() band (ADR 0074 D1 / D2 / D4): the panels, the characters, the bubbles and their tails, the blanks in
// their empty state. The text is not outlined and not measured here: a line is one <text> drawn from its start, and every atom's width came from the layout.
import {escapeXml} from '../emit-common.ts';
import {scopeOf} from '../scope-name.ts';
import {balloonPath} from './balloon-path.ts';
import {BADGE, COLOR, FONT, FRAME, SLOT_FONT, TAIL_HALF, f1} from './constants.ts';
import {characterSvg} from './character.ts';
import {faceSvg} from './face.ts';
import type {ComicLaidBubble, ComicLaidHead, ComicLaidPanel, ComicLaidSlot, LaidOutComic} from '../types/comic.ts';

const tintOf = (p: ComicLaidPanel): string => p.tint === 'warm' ? COLOR.warm : p.tint === 'cool' ? COLOR.cool : COLOR.paper;

function personSvg(h: ComicLaidHead, p: ComicLaidPanel, characters: LaidOutComic['characters'], namespace: string, clipId: string): string {
  // Dots are reserved in comic ids. Escaping hyphens keeps the two components distinct when joined.
  const prefix = `ch-${namespace}${p.id.replaceAll('-', '.')}-${h.who.replaceAll('-', '.')}`;
  const look = h.look;
  if (look.kind === 'asset') {
    const ch = characters[look.asset];
    const svg = ch && characterSvg(ch, h.expression, h, `${prefix}-`);
    if (svg) return `<g data-head="${h.id}" clip-path="url(#${clipId})">${svg}</g>`;
  }
  const face = look.kind === 'face' ? look : {hue: 210, hair: 'short' as const};
  return `<g data-head="${h.id}">${faceSvg(h, face.hue, face.hair, p.y + p.h, prefix)}</g>`;
}

function panelSvg(p: ComicLaidPanel, characters: LaidOutComic['characters'], namespace: string): string {
  const clipId = `pc-${namespace}${p.id}`;
  const out = [`<g data-panel="${p.id}"><clipPath id="${clipId}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${tintOf(p)}" stroke="${COLOR.ink}" stroke-width="${FRAME}"/>`];
  if (p.label !== undefined) out.push(`<rect x="${p.x - 8}" y="${p.y - 8}" width="${BADGE}" height="${BADGE}" fill="${COLOR.ink}"/><text x="${p.x - 8 + BADGE / 2}" y="${p.y - 8 + 17}" text-anchor="middle" font-size="${SLOT_FONT}" font-weight="700" fill="${COLOR.paper}">${escapeXml(p.label)}</text>`);
  for (const h of p.heads) out.push(personSvg(h, p, characters, namespace, clipId));
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
  const scope = scopeOf(b);
  // A leading hyphen reserves the scoped namespace. Scope names can contain characters that are unsafe in url(#id).
  const namespace = scope ? `-${scope.split('').map(c => c.charCodeAt(0).toString(16)).join('_')}-` : '';
  return `<g data-comic="${b.layout}"><title>${escapeXml(b.title)}</title>${b.panels.map(p => panelSvg(p, b.characters, namespace)).join('')}${b.bubbles.map(x => bubbleSvg(x, b.blank)).join('')}</g>`;
}
