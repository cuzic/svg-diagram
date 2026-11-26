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
export function stampGeometry(band: Rect, stampW: number, stampH = 24): Rect {
  return {x: snap4(band.x + band.w - 8 - stampW), y: snap4(band.y + band.h - 6 - stampH), w: snap4(stampW), h: stampH};
}


export function renderStamp(band: Rect & {stamp?: string; stampW?: number; stampLines?: string[]; stampH?: number}, roles: Roles): string {
  if (!band.stamp || band.stampW === undefined) return '';
  const {x, y, w, h} = stampGeometry(band, band.stampW, band.stampH);
  const cx = snap4(band.x + band.w - 8 - band.stampW / 2);
  if (band.stampLines) { // a stamp that was wrapped: one text line per row, the first at the one-line chip's baseline
    const pitch = Math.round(roles.note * 1.4);
    const rows = band.stampLines.map((l, i) => `\n  <text x="${cx}" y="${y + 17 + i * pitch}" font-size="${roles.note}" text-anchor="middle" fill="${PALETTE.muted}">${emojiSpan(l)}</text>`).join('');
    return `\n  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${PALETTE.bg}" stroke="${PALETTE.border}" stroke-width="1"/>${rows}`;
  }
  return `\n  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${PALETTE.bg}" stroke="${PALETTE.border}" stroke-width="1"/>\n  <text x="${cx}" y="${y + 17}" font-size="${roles.note}" text-anchor="middle" fill="${PALETTE.muted}">${emojiSpan(band.stamp)}</text>`;
}

export function tagGeometry({x, y, w, h}: Rect): Rect {
  return {x: snap4(x), y: snap4(y), w: snap4(w), h};
}
