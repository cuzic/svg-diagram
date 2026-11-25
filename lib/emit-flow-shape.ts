import {anchoredSpotlightTarget} from './emit-spotlight.ts';
import type {SpotlightHooks} from './band-def.ts';
import {PALETTE, colorOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutFlowShape} from './flow-shapes.ts';
import {escapeAttr, emojiSpan, resolveBoxStyle} from './emit-common.ts';

/**
 * A flow shape (chevron / funnel / cycle / venn / concentric / emblem) dims ITSELF when its band is out of the spotlight: the outline, the text
 * and the arrows turn muted and an opaque fill turns white. (renderBand used to recolour every fill of a dimmed band to muted, which made a
 * filled shape and its muted text the same colour: the text vanished and the lint stopped the build.)
 */
export function renderFlowShape(b: LaidOutFlowShape, day: Theme, tones: ToneEnv): string {
  const out: string[] = [], n = (v: number) => Math.round(v * 10) / 10;
  const dn = (p: {dataNode?: string}): string => p.dataNode ? ` data-node="${escapeAttr(p.dataNode)}"` : ''; // ADR 0034, only when asked
  const ink = (c: string): string => b.dim ? PALETTE.muted : c, paper = (c: string): string => b.dim ? PALETTE.bg : c;
  for (const p of b.primitives) {
    if (p.k === 'polygon') {
      const s = resolveBoxStyle(tones, p.tone, day);
      out.push(`<polygon points="${p.points.map(q => `${n(q[0])},${n(q[1])}`).join(' ')}" fill="${paper(s.fill)}" stroke="${ink(s.stroke)}" stroke-width="${p.strong ? 3.5 : 2}"${s.dashed ? ' stroke-dasharray="6,4"' : ''}${dn(p)}/>`);
    } else if (p.k === 'circle' && p.fill) {
      const st = resolveBoxStyle(tones, p.fill, day);
      out.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${paper(st.fill)}" stroke="${ink(st.stroke)}" stroke-width="2"${st.dashed ? ' stroke-dasharray="6,4"' : ''}${dn(p)}/>`);
    } else if (p.k === 'circle') {
      const c = ink(colorOf(p.tone, day)); // a tinted ring: the same translucent fill, in muted
      out.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${c}" fill-opacity="${p.opacity ?? .16}" stroke="${c}" stroke-width="2"${p.dash ? ` stroke-dasharray="${p.dash}"` : ''}${dn(p)}/>`);
    } else if (p.k === 'rect') {
      out.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" rx="8" fill="none" stroke="${ink(colorOf(p.tone, day))}" stroke-width="2"/>`);
    } else if (p.fill) { // a filled shape drawn as a path (an emblem's pill / rounded / document / cylinder): dimmed like a polygon
      const st = resolveBoxStyle(tones, p.fill, day);
      out.push(`<path d="${p.d}" fill="${paper(st.fill)}" stroke="${ink(st.stroke)}" stroke-width="2"${st.dashed ? ' stroke-dasharray="6,4"' : ''}${dn(p)}/>`);
    } else {
      out.push(`<path d="${p.d}" fill="none" stroke="${ink(colorOf(p.tone, day))}" stroke-width="${p.thin ? 1.5 : 2}"${p.arrow ? ` marker-end="url(#${b.dim ? 'dsl-arrow-dim' : 'dsl-arrow'})"` : ''}/>`);
    }
  }
  for (const t of b.texts) out.push(`<text x="${n(t.tx)}" y="${n(t.ty)}"${t.anchor === 'start' ? '' : ` text-anchor="${t.anchor}"`} font-size="${t.size}" font-weight="${t.weight}" fill="${ink(colorOf(t.tone, day))}">${emojiSpan(t.text)}</text>`);
  return out.join('\n  ');
}

export const flowSpotlight: SpotlightHooks<never, LaidOutFlowShape> = {
  targets: (band, id, endpoint) => endpoint ? [] : anchoredSpotlightTarget(band, id),
  dim(band, focus) {
    band.dim = !focus.contains(band) && !band.anchors.some(focus.contains);
  },
};
