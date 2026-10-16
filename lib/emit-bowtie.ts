// The drawing of a bow-tie (ADR 0026 D4): the boxes (a tone for each role), the flow lines with an arrowhead where the flow goes on, and the knot
// of the top event (a circle above its box; FTA's ellipse means "conditioning event" and is not borrowed).
import {PALETTE, colorOf, toneStyle} from './tokens.ts';
import type {EmphasisTone, Theme} from './types/core.ts';
import type {BowtieRole, LaidOutBowtie} from './types/diagrams.ts';
import {arrowPath, snap4, emojiSpan} from './emit-common.ts';
import {renderBoxRect} from './emit-boxes.ts';

const ROLE_TONE: Record<BowtieRole, EmphasisTone> = {hazard: 'muted', threat: 'changed', barrier: 'accent', event: 'danger', consequence: 'danger'};

export function renderBowtie(b: LaidOutBowtie, day: Theme): string {
  const out: string[] = [];
  const line = b.dim ? PALETTE.muted : PALETTE.text;
  for (const e of b.edges) {
    if (e.arrow) out.push(arrowPath(e.points, line, undefined));
    else out.push(`<path d="M${e.points.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}" fill="none" stroke="${line}" stroke-width="2"/>`);
  }
  out.push(`<circle cx="${snap4(b.knot.cx)}" cy="${snap4(b.knot.cy)}" r="${b.knot.r}" fill="${PALETTE.bg}" stroke="${b.dim ? PALETTE.muted : PALETTE.danger}" stroke-width="3"/>`);
  for (const n of b.nodes) out.push(renderBoxRect({...n, tone: ROLE_TONE[n.role], dim: b.dim}, day, 'plain'));
  for (const t of b.texts) {
    const fill = b.dim ? PALETTE.muted : t.muted ? PALETTE.muted : colorOf(toneStyle('plain').text, day);
    out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="middle" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${fill}">${emojiSpan(t.text)}</text>`);
  }
  return out.join('\n  ');
}
