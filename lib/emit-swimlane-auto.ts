import {PALETTE, colorOf, textColorOf, toneStyle, isSolidTone} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutBpmn} from './types/diagrams.ts';
import {iconSvg} from './icon-svg.ts';
import {snap4, emojiSpan, resolveBoxStyle} from './emit-common.ts';
import {renderBoxRect} from './emit-box-frame.ts';

import {must} from './must.ts';
import {marked, partAttr, partsOn} from './parts.ts';
import {focusInk} from './emit-focus.ts';

export function renderSwimlaneAuto(b: LaidOutBpmn, day: Theme, tones: ToneEnv): string {
  const out: string[] = [], on = partsOn(b), pa = (part?: string): string => part ? partAttr(on, part) : '';
  const ink = b.dim ? PALETTE.muted : PALETTE.text, bg = PALETTE.bg;
  for (const l of b.lanes) {
    out.push(`<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${snap4(l.w)}" height="${snap4(l.h)}" fill="${l.tone === 'plain' ? bg : resolveBoxStyle(tones, l.tone, day).fill}" stroke="${PALETTE.muted}" stroke-width="2"${pa(l.part)}/>`);
    out.push(l.labelH === undefined
      ? `<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${l.labelW}" height="${snap4(l.h)}" fill="${PALETTE.code}" stroke="${PALETTE.muted}" stroke-width="2"${pa(l.part)}/>`
      : `<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${snap4(l.w)}" height="${l.labelH}" fill="${PALETTE.code}" stroke="${PALETTE.muted}" stroke-width="2"${pa(l.part)}/>`);
  }
  const edgeInk = focusInk(b.focused, b.dim, day, ink);
  for (const e of b.edges) {
    const ink = edgeInk(e.from, e.to);
    const pts = e.points.slice(), n = pts.length, tip = must(pts[n - 1]), prev = must(pts[n - 2]);
    const dx = Math.sign(tip.x - prev.x), dy = Math.sign(tip.y - prev.y), L = 11, W = 4.5;
    pts[n - 1] = {x: tip.x - dx * (L - 2), y: tip.y - dy * (L - 2)};
    out.push(`<path d="M${pts.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${ink}" stroke-width="2"${e.line === 'dashed' ? ' stroke-dasharray="6,4"' : ''}/>\n  <path d="M${snap4(tip.x)},${snap4(tip.y)} L${snap4(tip.x - dx * L - dy * W)},${snap4(tip.y - dy * L + dx * W)} L${snap4(tip.x - dx * L + dy * W)},${snap4(tip.y - dy * L - dx * W)} z" fill="${ink}"/>`);
  }
  for (const nd of b.nodes) {
    const at = out.length;
    drawNode(nd);
    for (let i = at; i < out.length; i++) out[i] = marked(must(out[i]), pa(nd.part));
  }
  function drawNode(nd: LaidOutBpmn['nodes'][number]): void {
    const cx = nd.x + nd.w / 2, cy = nd.y + nd.h / 2, st = b.dim ? PALETTE.muted : resolveBoxStyle(tones, nd.tone, day).stroke, fill = b.dim ? bg : resolveBoxStyle(tones, nd.tone, day).fill;
    if (nd.kind === 'task') { out.push(renderBoxRect({...nd, dim: b.dim}, day, tones, 'plain')); return; }
    if (nd.kind === 'start' || nd.kind === 'end') { out.push(`<circle cx="${snap4(cx)}" cy="${snap4(cy)}" r="${nd.w / 2 - 2}" fill="${fill}" stroke="${st}" stroke-width="${nd.kind === 'end' ? 5 : 2}"/>`); return; }
    const r = nd.w / 2;
    out.push(`<path d="M${snap4(cx)},${snap4(nd.y)} L${snap4(nd.x + nd.w)},${snap4(cy)} L${snap4(cx)},${snap4(nd.y + nd.h)} L${snap4(nd.x)},${snap4(cy)} z" fill="${fill}" stroke="${st}" stroke-width="2"/>`);
    const m = r * 0.42, mark = !b.dim && isSolidTone(nd.tone) ? colorOf(toneStyle(tones, nd.tone).text, day) : st; // the gateway's mark: white on a solid fill
    if (nd.kind === 'xor') out.push(`<path d="M${snap4(cx - m)},${snap4(cy - m)} L${snap4(cx + m)},${snap4(cy + m)} M${snap4(cx + m)},${snap4(cy - m)} L${snap4(cx - m)},${snap4(cy + m)}" fill="none" stroke="${mark}" stroke-width="3"/>`);
    else if (nd.kind === 'and') out.push(`<path d="M${snap4(cx - m * 1.15)},${snap4(cy)} H${snap4(cx + m * 1.15)} M${snap4(cx)},${snap4(cy - m * 1.15)} V${snap4(cy + m * 1.15)}" fill="none" stroke="${mark}" stroke-width="3"/>`);
    else out.push(`<circle cx="${snap4(cx)}" cy="${snap4(cy)}" r="${snap4(m * 1.2)}" fill="none" stroke="${mark}" stroke-width="3"/>`);
  }
  for (const t of b.texts) {
    const n = b.nodes.find(r => r.kind === 'task' && t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}"${t.anchor === 'middle' ? ' text-anchor="middle"' : t.anchor === 'end' ? ' text-anchor="end"' : ''} font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${b.dim ? PALETTE.muted : n && isSolidTone(n.tone) ? colorOf(toneStyle(tones, n.tone).text, day) : t.muted ? (n && toneStyle(tones, n.tone).fill === 'soft' ? PALETTE.text : PALETTE.muted) : colorOf(toneStyle(tones, n?.tone).text, day)}"${pa(t.part)}>${emojiSpan(t.text)}</text>`);
  }
  for (const ic of b.icons) out.push(marked(iconSvg({glyph: ic.glyph, name: ic.name, x: ic.x, y: ic.y, size: ic.size, color: b.dim ? PALETTE.muted : ic.tone && !isSolidTone(must(b.nodes[ic.node]).tone) ? textColorOf(tones, ic.tone, day) : colorOf(toneStyle(tones, must(b.nodes[ic.node]).tone).text, day), dim: b.dim, labelled: true}), pa(b.nodes[ic.node]?.part))); // on a solid fill the icon is white, whatever iconTone says
  for (const l of b.labels) {
    out.push(`<rect x="${snap4(l.x)}" y="${snap4(l.y)}" width="${snap4(l.w)}" height="${l.h}" fill="${bg}"/>`);
    out.push(`<text x="${Math.round(l.tx)}" y="${Math.round(l.ty + snap4(l.y) - l.y)}" text-anchor="middle" font-size="${l.size}" fill="${ink}">${emojiSpan(l.text)}</text>`);
  }
  return out.join('\n  ');
}
