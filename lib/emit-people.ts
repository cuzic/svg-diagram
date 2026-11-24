
import {colorOf, textColorOf, toneStyle} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutPeople} from './types/people-dots.ts';
import {PERSON_BOX, PERSON_PATH} from './people.ts';
import {escapeAttr, emojiSpan} from './emit-common.ts';

// people(): one person icon per head, the emphasized ones filled and the rest outlines (the count reads without colour).
export function renderPeople(band: LaidOutPeople, day: Theme, tones: ToneEnv): string {
  const d = PERSON_PATH, s = band.size / PERSON_BOX.size, n = (v: number) => +v.toFixed(4);
  const color = colorOf(toneStyle(tones, band.tone).ink, day), color2 = colorOf(toneStyle(tones, band.tone2).ink, day), rest = colorOf(toneStyle(tones, band.rest).ink, day);
  const icon = (i: {x: number; y: number; on: boolean; second?: true}) => `<path d="${d}" transform="translate(${n(i.x - PERSON_BOX.from * s)} ${n(i.y - PERSON_BOX.from * s)}) scale(${n(s)})" ${i.on ? `fill="${i.second ? color2 : color}"` : `fill="none" stroke="${rest}" stroke-width="${n(1.5 / s)}"`}/>`;
  const texts = band.texts.map(t => `\n  <text x="${Math.round(t.x)}" y="${Math.round(t.y)}" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${textColorOf(tones, t.tone, day)}">${emojiSpan(t.text)}</text>`).join('');
  return `<g role="img" aria-label="${escapeAttr(band.alt)}">\n  ${band.icons.map(icon).join('\n  ')}\n  </g>${texts}`;
}
