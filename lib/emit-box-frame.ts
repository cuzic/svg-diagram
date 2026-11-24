import {PALETTE} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {EmphasisTone, Rect, Roles, Theme} from './types/core.ts';
import {emojiSpan, escapeAttr, resolveBoxStyle, snap4} from './emit-common.ts';

export type BoxLike = Rect & {tone?: EmphasisTone; dashed?: boolean; dim?: boolean; /** ADR 0034: written as `data-node` on the frame */ dataNode?: string};

export function frameGeometry(rect: Rect): Rect {
  // Snap the right edge too, so adjacent frames with the same extent end at the same point.
  const x = snap4(rect.x);
  return {x, y: snap4(rect.y), w: snap4(rect.x + rect.w) - x, h: snap4(rect.h)};
}

export function renderBoxRect(band: BoxLike, day: Theme, tones: ToneEnv, defaultTone: EmphasisTone): string {
  const style = resolveBoxStyle(tones, band.tone ?? defaultTone, day, band.dashed);
  if (band.dim) { style.fill = PALETTE.bg; style.stroke = PALETTE.muted; }
  const dash = style.dashed ? ' stroke-dasharray="6,4"' : band.dim ? ' stroke-dasharray="2,5" stroke-linecap="round"' : '';
  const {x: rx, y: ry, w: rw, h: rh} = frameGeometry(band);
  return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2.5"${dash}${band.dataNode ? ` data-node="${escapeAttr(band.dataNode)}"` : ''}/>`;
}

// The stamp chip follows the bottom edge even when layout stretches the frame.
export function stampGeometry(band: Rect, stampW: number): Rect {
  return {x: snap4(band.x + band.w - 8 - stampW), y: snap4(band.y + band.h - 6 - 24), w: snap4(stampW), h: 24};
}


export function renderStamp(band: Rect & {stamp?: string; stampW?: number}, roles: Roles): string {
  if (!band.stamp || band.stampW === undefined) return '';
  const {x, y, w, h} = stampGeometry(band, band.stampW);
  return `\n  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${PALETTE.bg}" stroke="${PALETTE.border}" stroke-width="1"/>\n  <text x="${snap4(band.x + band.w - 8 - band.stampW / 2)}" y="${y + 17}" font-size="${roles.note}" text-anchor="middle" fill="${PALETTE.muted}">${emojiSpan(band.stamp)}</text>`;
}
