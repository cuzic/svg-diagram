import {fmt} from './axis-ticks.ts';
import {visibleAt} from './reveal-visibility.ts';
import type {BarsBand} from './types/bars.ts';
import type {Band} from './types/index.ts';
import type {BoxBand} from './types/text-bands.ts';

export const oneLine = (t: unknown): string => String(t ?? '').replace(/\s*\n\s*/g, ' ').trim();

/** Values are on neither a label nor a scale: the figure alone cannot be read for them. */
export const barsValuesHidden = (band: BarsBand): boolean => band.labels !== undefined && band.labels !== 'all' && band.axis === false;

/** Describe the visible content in the supplied band order. */
export function describeBands(all: Band[], stage?: number): string {
  const parts: string[] = [];
  const bands = all.filter(b => visibleAt(b as {reveal?: number; until?: number}, stage));
  for (const b of bands) {
    if (b.type === 'swimlane') {
      parts.push(`レーン: ${b.lanes.map(l => oneLine(l.label)).join('、')}`);
      parts.push(`手順: ${b.steps.filter(s => visibleAt(s, stage)).map(s => oneLine(s.title)).join('、')}`);
    } else if (b.type === 'sequence') parts.push(`参加者: ${b.actors.map(a => oneLine(a.label)).join('、')}`);
    else if (b.type === 'table') parts.push(`表${b.title ? `「${oneLine(b.title)}」` : ''}: 列 ${b.columns.map(c => oneLine(c.label)).join('、')}`);
  }
  if (!parts.length) {
    const titles = bands.filter((b): b is BoxBand => b.type === 'box' && !!b.title).map(b => oneLine(b.title));
    if (titles.length) parts.push(`要素: ${titles.slice(0, 16).join('、')}${titles.length > 16 ? ' ほか' : ''}`);
  }
  for (const b of all) if (b.type === 'image' && b.alt) parts.push(`画像: ${oneLine(b.alt)}`);
  for (const b of all) if (b.type === 'math') parts.push(`数式: ${oneLine(b.alt)}`);
  // outside the fallback above, so boxes and hidden-value bars can share one description
  for (const b of bands) if (b.type === 'bars' && barsValuesHidden(b)) parts.push(`値: ${b.data.filter(x => visibleAt(x, stage)).map(x => `${oneLine(x.label)} ${x.range ? `${fmt(x.range[0])}〜${fmt(x.range[1])}` : fmt(x.value ?? 0)}${b.unit ?? ''}`).join('、')}`);
  for (const b of bands) if (b.type === 'chart') parts.push(oneLine(b.alt));
  return parts.join('。');
}
