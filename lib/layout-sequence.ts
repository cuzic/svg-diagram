
import {must} from './must.ts';
import type {TextRequest, WidthOf, Roles, WrapMode} from './types/core.ts';
import type {SequenceBand, PreparedSequence, PreparedStep, LaidOutSequence, LaidOutSeqStep, LaidOutSeqHead} from './types/sequence-table-swimlane.ts';
import {lineH, textW, wrap} from './seq-table-text.ts';

export const SEQ_ICON = 20, SEQ_ICON_H = SEQ_ICON + 4; // an icon above a participant's label: its size and the room it takes
export const SEQ = {headPadY: 12, headPadX: 12, stepGap: 14, labelGap: 10, selfW: 36, noteH: 8, dividerH: 36};

export function prepareSequence(band: SequenceBand): PreparedSequence {
  let n = 0;
  const steps = band.steps.map((s): PreparedStep => {
    if (s.divider !== undefined) return {...s, kind: 'divider', text: s.divider};
    if (s.note !== undefined) return {...s, kind: 'note', text: s.note, over: [s.over].flat()};
    const numbered = band.numbered !== false && s.number !== false;
    const text = numbered ? `${++n}. ${s.label}` : s.label;
    return s.self !== undefined ? {...s, kind: 'self', text} : {...s, kind: 'msg', text};
  });
  return {...band, steps};
}

export function sequenceTexts(band: SequenceBand, roles: Roles): TextRequest[] {
  const out: TextRequest[] = [];
  const p = prepareSequence(band);
  for (const a of p.actors) out.push([a.label, roles.title, 700, 'sans']);
  for (const s of p.steps) out.push([s.text, roles.note, s.kind === 'divider' ? 700 : 400, 'sans']);
  return out;
}

export function layoutSequence(band: SequenceBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): LaidOutSequence {
  const p = prepareSequence(band);
  const n = p.actors.length;
  const colW = w / n;
  const aw = Math.min(200, colW - 16);
  const cx = p.actors.map((_, i) => x + colW * (i + 0.5));
  const idx = new Map(p.actors.map((a, i) => [a.id, i]));
  const at = (id: string, what: string): number => {
    const i = idx.get(id);
    if (i === undefined) throw new Error(`sequence(): unknown actor "${id}" in ${what}`);
    return i;
  };

  const heads = p.actors.map((a, i): LaidOutSeqHead => {
    const lines = wrap(a.label, roles.title, 700, 'sans', aw - 2 * SEQ.headPadX, widthOf, mode);
    const ci = must(cx[i]);
    return {id: a.id, tone: a.tone, lines, x: ci - aw / 2, w: aw, cx: ci, y: 0, h: 0, textDy: SEQ.headPadY};
  });
  // every head is as tall as the tallest; when any head has an icon, each head's stack (icon, then label) sits in the middle of the room
  const anyIcon = p.actors.some(a => a.icon), textH = Math.max(...heads.map(h => h.lines.length)) * lineH(roles.title);
  const headH = textH + (anyIcon ? SEQ_ICON_H : 0) + 2 * SEQ.headPadY;
  heads.forEach((h, i) => {
    const a = must(p.actors[i]);
    h.y = y; h.h = headH;
    const top = SEQ.headPadY + (anyIcon ? Math.round((headH - 2 * SEQ.headPadY - h.lines.length * lineH(roles.title) - (a.icon ? SEQ_ICON_H : 0)) / 2) : 0);
    h.textDy = top + (a.icon ? SEQ_ICON_H : 0);
    if (a.icon) h.icon = {name: a.icon, glyph: must(a.iconGlyph), x: h.cx - SEQ_ICON / 2, y: y + top, size: SEQ_ICON, ...(a.iconTone ? {tone: a.iconTone} : {})};
  });

  let cursor = y + headH;
  const steps: LaidOutSeqStep[] = [];
  for (const s of p.steps) {
    const top = cursor + SEQ.stepGap / 2;
    if (s.kind === 'msg') {
      const i = at(s.from, 'from'), j = at(s.to, 'to');
      if (i === j) throw new Error(`sequence(): message "${s.label}" has from === to; use {self: id}`);
      const span = Math.abs(must(cx[j]) - must(cx[i]));
      // a label may run across neighbouring lifelines (as in UML); it only has to stay on the canvas
      const mid = (must(cx[i]) + must(cx[j])) / 2;
      const room = Math.min(2 * (mid - x), 2 * (x + w - mid)) - 8;
      const lines = wrap(s.text, roles.note, 400, 'sans', Math.min(room, Math.max(span - 20, 320)), widthOf, mode);
      const labelH = lines.length * lineH(roles.note);
      const ay = top + labelH + SEQ.labelGap;
      steps.push({kind: 'msg', x1: must(cx[i]), x2: must(cx[j]), y: ay, lines, labelTop: top, lx: (must(cx[i]) + must(cx[j])) / 2, line: s.line ?? 'solid', arrow: s.arrow ?? 'end', tone: s.tone});
      cursor = ay + SEQ.stepGap;
    } else if (s.kind === 'self') {
      const i = at(s.self, 'self');
      // The loop and its label go on the right of the lifeline, unless the label does not fit there at its natural
      // width and the left side has more room (the last actor): then both mirror to the left, inside the frame.
      const ci = must(cx[i]), rightRoom = x + w - (ci + SEQ.selfW + 8) - 4, leftRoom = ci - SEQ.selfW - 8 - x - 4;
      const side = textW(s.text, roles.note, 400, 'sans', widthOf) > rightRoom && leftRoom > rightRoom ? 'left' : 'right';
      const lx = side === 'left' ? ci - SEQ.selfW - 8 : ci + SEQ.selfW + 8;
      const lines = wrap(s.text, roles.note, 400, 'sans', Math.max(40, side === 'left' ? leftRoom : rightRoom), widthOf, mode);
      const labelH = lines.length * lineH(roles.note);
      const loopH = 22;
      const rowH = Math.max(labelH, loopH + 12);
      steps.push({kind: 'self', cx: ci, y: top + 6, loopH, lines, lx, side, labelTop: top, line: s.line ?? 'solid', tone: s.tone});
      cursor = top + rowH + SEQ.stepGap / 2;
    } else if (s.kind === 'note') {
      const ids = s.over.map(id => at(id, 'note.over'));
      const lo = Math.min(...ids), hi = Math.max(...ids);
      let left: number, right: number;
      if (lo === hi) { const nw = Math.min(aw + 40, 260); left = must(cx[lo]) - nw / 2; right = must(cx[lo]) + nw / 2; }
      else { left = Math.max(x, must(cx[lo]) - 60); right = Math.min(x + w, must(cx[hi]) + 60); }
      const lines = wrap(s.text, roles.note, 400, 'sans', right - left - 24, widthOf, mode);
      const h = lines.length * lineH(roles.note) + 16;
      steps.push({kind: 'note', x: left, y: top, w: right - left, h, lines, tone: s.tone ?? 'muted'});
      cursor = top + h + SEQ.stepGap / 2;
    } else { // divider
      const tw = textW(s.text, roles.note, 700, 'sans', widthOf) + 24;
      steps.push({kind: 'divider', y: top + 14, x1: x, x2: x + w, cx: x + w / 2, chipW: tw, text: s.text});
      cursor = top + SEQ.dividerH - SEQ.stepGap / 2;
    }
  }
  const bottom = cursor + 4;
  return {type: 'sequence', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: bottom - y, heads, steps, lifeTop: y + headH, lifeBottom: bottom};
}
