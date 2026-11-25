import {PALETTE, colorOf} from './tokens.ts';
import {badgeSvg, pillSvg} from './badge.ts';
import type {Theme, ColorKey, Rect} from './types/core.ts';
import type {Prim} from './types/wireframe-nodes.ts';
import type {LaidOutWireframe, LaidOutScreens} from './types/wireframe.ts';
import {snap4, escapeXml, emojiSpan} from './emit-common.ts';

export type PaintPrim = Exclude<Prim, {k: 'text' | 'badge' | 'pill'}>;

export function primRectGeometry(rect: Rect): Rect {
  const x = snap4(rect.x), y = snap4(rect.y);
  return {x, y, w: Math.max(0, snap4(rect.x + rect.w) - x), h: Math.max(0, snap4(rect.y + rect.h) - y)};
}

export function renderPrims(b: LaidOutWireframe | LaidOutScreens, day: Theme): string {
  const col = (k: ColorKey | null): string => k == null ? 'none' : colorOf(k, day);
  const stroke = (p: PaintPrim): string => {
    const dash = 'dash' in p ? p.dash : undefined; // circles have no dash
    return p.stroke ? ` stroke="${col(p.stroke)}" stroke-width="${p.sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}` : '';
  };
  const fill = (p: PaintPrim): string => `fill="${col(p.fill)}"${p.op != null && p.fill ? ` fill-opacity="${p.op}"` : ''}`;
  const out: string[] = [];
  for (const p of b.prims) {
    if (p.k === 'rect') {
      const {x, y, w, h} = primRectGeometry(p);
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}"${p.r ? ` rx="${p.r}"` : ''} ${fill(p)}${stroke(p)}/>`);
    } else if (p.k === 'circle') {
      out.push(`<circle cx="${snap4(p.cx)}" cy="${snap4(p.cy)}" r="${p.r}" ${fill(p)}${stroke(p)}/>`);
    } else if (p.k === 'path') {
      out.push(`<path d="${p.d}" ${fill(p)}${stroke(p)}${p.stroke ? ' stroke-linejoin="round"' : ''}/>`);
    } else if (p.k === 'pill') {
      out.push(pillSvg({...primRectGeometry(p), fill: col(p.fill), stroke: p.stroke ? col(p.stroke) : null, cx: p.x + p.w / 2, baseline: p.base, rawY: p.y, text: col(p.text), size: p.size, labelHtml: emojiSpan(p.label)}));
    } else if (p.k === 'badge') {
      out.push(badgeSvg({cx: p.cx, cy: p.cy, r: p.r, w: p.w, shape: p.shape, label: p.label, aria: p.aria, size: p.size, fill: col(p.fill), stroke: PALETTE.bg, sw: 2, snap: snap4, esc: escapeXml}));
    } else if (p.k === 'text') {
      const a = p.anchor === 'middle' ? ' text-anchor="middle"' : p.anchor === 'end' ? ' text-anchor="end"' : '';
      out.push(`<text x="${Math.round(p.x)}" y="${Math.round(p.y)}"${a} font-size="${p.size}" font-weight="${p.weight}" fill="${col(p.fill)}">${emojiSpan(p.s)}</text>`);
    }
  }
  return out.join('\n  ');
}
