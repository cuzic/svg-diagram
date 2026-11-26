import {PALETTE, colorOf, toneStyle, isSolidTone} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutStates} from './types/diagrams.ts';
import {iconSvg} from './icon-svg.ts';
import {snap4, escapeXml, emojiSpan, lineAttrs, resolveBoxStyle} from './emit-common.ts';
import {frameGeometry, renderBoxRect} from './emit-box-frame.ts';
import {badgeSvg} from './badge.ts';
import {DOUBLE_INSET} from './cause-roles.ts';

import {must} from './must.ts';

export function renderStates(b: LaidOutStates, day: Theme, tones: ToneEnv): string {
  const out: string[] = [];
  const stroke = b.dim ? PALETTE.muted : PALETTE.text;
  const inkOf = (tone: 'danger' | 'accent' | 'muted' | undefined): string => b.dim ? PALETTE.muted : tone === undefined ? PALETTE.text : tone === 'muted' ? PALETTE.muted : colorOf(tone, day);
  // arrowheads are drawn as shapes, not markers: a marker on a leftward end is not turned by every renderer (resvg leaves it pointing right)
  for (const e of b.edges) {
    const pts = e.points.slice(), n = pts.length, tip = must(pts[n - 1]), prev = must(pts[n - 2]), color = inkOf(e.tone);
    const dx = Math.sign(tip.x - prev.x), dy = Math.sign(tip.y - prev.y), L = e.strong ? 16 : 12, W = e.strong ? 7 : 5;
    pts[n - 1] = {x: tip.x - dx * (L - 2), y: tip.y - dy * (L - 2)}; // the line stops inside the head
    const head = `M${snap4(tip.x)},${snap4(tip.y)} L${snap4(tip.x - dx * L - dy * W)},${snap4(tip.y - dy * L + dx * W)} L${snap4(tip.x - dx * L + dy * W)},${snap4(tip.y - dy * L - dx * W)} z`;
    out.push(`<path d="M${pts.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${color}" stroke-width="${e.strong ? 4 : 2}"${lineAttrs(e.line === 'solid' ? undefined : e.line)}/>\n  <path d="${head}" fill="${color}"/>`);
  }
  if (b.initial) out.push(`<circle cx="${snap4(b.initial.x)}" cy="${snap4(b.initial.y)}" r="${b.initial.r}" fill="${stroke}"/>`);
  for (const n of b.nodes) {
    if (n.circle) { // an event: a circle in its tone's colours
      const st = b.dim ? {fill: PALETTE.bg, stroke: PALETTE.muted, dashed: false} : resolveBoxStyle(tones, n.tone, day);
      out.push(`<circle cx="${snap4(n.x + n.w / 2)}" cy="${snap4(n.y + n.h / 2)}" r="${snap4(n.w / 2)}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2.5"/>`);
      continue;
    }
    if (n.shape === 'diamond') { // a decision: a diamond in its tone's colours (a path, like a gateway: a polygon does not reach the HTML output)
      const st = resolveBoxStyle(tones, n.tone, day);
      if (b.dim) { st.fill = PALETTE.bg; st.stroke = PALETTE.muted; }
      const {x: rx, y: ry, w: rw, h: rh} = frameGeometry(n);
      const dash = st.dashed ? ' stroke-dasharray="6,4"' : b.dim ? ' stroke-dasharray="2,5" stroke-linecap="round"' : '';
      out.push(`<path d="M${rx + rw / 2},${ry} L${rx + rw},${ry + rh / 2} L${rx + rw / 2},${ry + rh} L${rx},${ry + rh / 2} Z" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2.5" stroke-linejoin="round"${dash}/>`);
      continue;
    }
    if (n.shape === 'pill') { // a terminator: the box's rect with the ends rounded to half the height
      out.push(renderBoxRect({...n, dim: b.dim}, day, tones, 'plain').replace('rx="8"', `rx="${snap4(n.h) / 2}"`));
      continue;
    }
    out.push(renderBoxRect({...n, dim: b.dim}, day, tones, 'plain'));
    // the inner outline of an end state: on a solid fill its stroke would be the fill colour, so it is drawn in the text colour (white)
    const inner = renderBoxRect({x: n.x + DOUBLE_INSET, y: n.y + DOUBLE_INSET, w: n.w - 2 * DOUBLE_INSET, h: n.h - 2 * DOUBLE_INSET, tone: n.tone, dim: b.dim}, day, tones, 'plain').replace('rx="8"', 'rx="5"');
    if (n.final) out.push(!b.dim && isSolidTone(n.tone) ? inner.replace(/stroke="[^"]*"/, `stroke="${colorOf(toneStyle(tones, n.tone).text, day)}"`) : inner);
  }
  const ink = (t: LaidOutStates['texts'][number]): string => {
    if (b.dim) return PALETTE.muted;
    const n = b.nodes.find(r => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
    if (n && isSolidTone(n.tone)) return colorOf(toneStyle(tones, n.tone).text, day); // white on the fill, the sub line too
    if (t.muted) return n && toneStyle(tones, n.tone).fill === 'soft' ? PALETTE.text : PALETTE.muted; // muted on a soft fill is 4.48:1, under 4.5
    return colorOf(toneStyle(tones, n?.tone).text, day);
  };
  for (const k of b.badges ?? []) out.push(badgeSvg({cx: k.cx, cy: k.cy, r: k.r, w: 2 * k.r, shape: 'circle', label: k.label, aria: `質問 ${k.label}`, size: k.size, fill: b.dim ? PALETTE.muted : PALETTE[day].accent, snap: snap4, esc: escapeXml}));
  for (const t of b.texts) out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="middle" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${ink(t)}">${emojiSpan(t.text)}</text>`);
  for (const ic of b.icons) out.push(iconSvg({glyph: ic.glyph, name: ic.name, x: ic.x, y: ic.y, size: ic.size, color: b.dim ? PALETTE.muted : colorOf(toneStyle(tones, must(b.nodes[ic.node]).tone).text, day), dim: b.dim, labelled: true}));
  for (const l of b.labels) {
    out.push(`<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${snap4(l.w)}" height="${l.h}" fill="${PALETTE.bg}"/>`);
    out.push(`<text x="${Math.round(l.tx)}" y="${Math.round(l.ty + snap4(l.y) - l.y)}" text-anchor="middle" font-size="${l.size}" fill="${stroke}">${emojiSpan(l.text)}</text>`);
  }
  return out.join('\n  ');
}
