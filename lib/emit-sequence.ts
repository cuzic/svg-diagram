import {PALETTE, runColorOf} from './tokens.ts';
import {marked, partAttr, partStep, partsOn} from './parts.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme, Roles} from './types/core.ts';
import type {LaidOutSequence} from './types/sequence-table-swimlane.ts';
import {iconSvg} from './icon-svg.ts';
import {snap4, resolveLineColor, strokeLine, textLines, resolveBoxStyle} from './emit-common.ts';

export function renderSequence(band: LaidOutSequence, day: Theme, tones: ToneEnv, roles: Roles): string {
  // ADR 0054: a participant (its head, icon, name and lifeline) and a message (its line and label) are parts
  const on = partsOn(band), who = (i: number): string => partAttr(on, partStep('participant', band.heads[i]?.id ?? i, band.heads[i]?.lines.join('') ?? ''));
  const all: string[] = [];
  let mark = '';
  const parts = {push: (...xs: string[]) => all.push(...xs.map(x => marked(x, mark)))};
  for (const [i, h] of band.heads.entries()) {
    mark = who(i);
    parts.push(`<path d="M${Math.round(h.cx)},${Math.round(h.y + h.h)} L${Math.round(h.cx)},${Math.round(band.lifeBottom)}" fill="none" stroke="${PALETTE.border}" stroke-width="2" stroke-dasharray="6,6"/>`);
  }
  for (const [i, h] of band.heads.entries()) {
    mark = who(i);
    const st = resolveBoxStyle(tones, h.tone ?? 'plain', day);
    parts.push(`<rect x="${snap4(h.x)}" y="${snap4(h.y)}" width="${snap4(h.w)}" height="${snap4(h.h)}" rx="8" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2.5"${st.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    if (h.icon) parts.push(iconSvg({glyph: h.icon.glyph, name: h.icon.name, x: h.icon.x, y: h.icon.y, size: h.icon.size, color: runColorOf(tones, h.icon.tone, h.tone, day), labelled: true}));
    parts.push(textLines(h.lines, {x: h.cx, top: h.y + h.textDy, size: roles.title, weight: 700, anchor: 'middle', fill: PALETTE.text}));
  }
  for (const [i, s] of band.steps.entries()) {
    mark = s.kind === 'msg' || s.kind === 'self' ? partAttr(on, partStep('message', i, s.lines.join(''))) : s.kind === 'note' ? partAttr(on, partStep('note', i, s.lines.join(''))) : '';
    if (s.kind === 'msg') {
      const color = resolveLineColor(tones, s.tone, day);
      parts.push(strokeLine(`M${Math.round(s.x1)},${Math.round(s.y)} L${Math.round(s.x2)},${Math.round(s.y)}`, color, s.line, s.arrow));
      parts.push(textLines(s.lines, {x: s.lx, top: s.labelTop, size: roles.note, anchor: 'middle', fill: s.tone ? color : PALETTE.text}));
    } else if (s.kind === 'self') {
      const color = resolveLineColor(tones, s.tone, day);
      const dir = s.side === 'left' ? -1 : 1;
      const x0 = Math.round(s.cx), x1 = Math.round(s.cx + dir * 36), y0 = Math.round(s.y), y1 = Math.round(s.y + s.loopH);
      parts.push(strokeLine(`M${x0},${y0} L${x1},${y0} L${x1},${y1} L${x0},${y1}`, color, s.line, 'end'));
      parts.push(textLines(s.lines, {x: s.lx, top: s.labelTop, size: roles.note, anchor: s.side === 'left' ? 'end' : undefined, fill: s.tone ? color : PALETTE.text}));
    } else if (s.kind === 'note') {
      const st = resolveBoxStyle(tones, s.tone, day);
      parts.push(`<rect x="${snap4(s.x)}" y="${snap4(s.y)}" width="${snap4(s.w)}" height="${snap4(s.h)}" rx="8" fill="${st.fill}" stroke="${st.stroke}" stroke-width="2.5"${st.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
      parts.push(textLines(s.lines, {x: s.x + 12, top: s.y + 8, size: roles.note, fill: PALETTE.text}));
    } else {
      parts.push(`<path d="M${Math.round(s.x1)},${Math.round(s.y)} L${Math.round(s.x2)},${Math.round(s.y)}" fill="none" stroke="${PALETTE.muted}" stroke-width="2" stroke-dasharray="6,4"/>`);
      parts.push(`<rect x="${snap4(s.cx - s.chipW / 2)}" y="${snap4(s.y - 12)}" width="${snap4(s.chipW)}" height="24" rx="12" fill="${PALETTE.bg}" stroke="${PALETTE.muted}" stroke-width="2"/>`);
      parts.push(textLines([s.text], {x: s.cx, top: s.y - 12 + 1, size: roles.note, weight: 700, anchor: 'middle', fill: PALETTE.text}));
    }
  }
  return all.join('\n  ');
}
