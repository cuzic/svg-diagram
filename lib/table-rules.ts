import {at} from './finding-rules.ts';
import {toneStyle} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutTable, TableBand} from './types/sequence-table-swimlane.ts';
import type {Finding} from './types/verdicts.ts';

export function semanticTableFindings(b: TableBand): Finding[] {
  return (b.semanticWarnings ?? []).map(message => ({...at(b), rule: 'semantic-table-warning', severity: 'warn', message}));
}

// rowHeader paints the heading cell soft, so a row with the same fill loses the distinction.
export function rowHeaderFindings(b: LaidOutTable, tones: ToneEnv): Finding[] {
  if (!b.rowHeader) return [];
  const rows = b.rows.filter(r => !r.header && toneStyle(tones, r.tone).fill === 'soft');
  if (!rows.length) return [];
  const names = rows.slice(0, 4).map(r => `「${(r.cells[0]?.lines[0] ?? '').slice(0, 12)}」`).join('');
  return [{...at(b), rule: 'rowheader-tone-collides', severity: 'warn', message: `表の行ラベルは soft で塗るが、${names}${rows.length > 4 ? ` ほか ${rows.length - 4} 行` : ''}は行のトーン（${[...new Set(rows.map(r => r.tone))].join('・')}）も soft なので、行ラベルと本文の塗りが同じになる。muted / changed / 太字の文字などに変えるか、行のトーンを外す`}];
}
