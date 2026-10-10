// Documents <-> diagrams: do the Markdown pages and the generated SVGs still agree?
// Pure string work (no browser), so it can run anywhere and be unit-tested.
//
//   scanMarkdown(text)            every  ![alt](...svg)  in a page, with the numbered list that follows it
//   parseItem(raw)                "**title**：text"  ->  {title, text}
//   compareNotes(items, notes)    the list in the page vs the figure's own notes  ->  findings

import type {DocImage, DocNoteItem, Finding, WfNote, Band} from './types.ts';

const IMG = /!\[([^\]]*)\]\(([^)\s]+\.svg)\)/g;
const norm = (s: unknown): string => String(s ?? '').replace(/\s+/g, '').replace(/：/g, ':');

export function scanMarkdown(text: string): DocImage[] {
  const lines = text.split('\n'), out: DocImage[] = [];
  lines.forEach((ln, i) => { for (const m of ln.matchAll(IMG)) out.push({line: i + 1, alt: m[1], ref: m[2], items: listAfter(lines, i)}); });
  return out;
}

// the first numbered list after line i, stopping at the next heading or image (at most 40 lines on)
function listAfter(lines: string[], i: number): DocNoteItem[] {
  const items: DocNoteItem[] = [];
  for (let j = i + 1; j < Math.min(lines.length, i + 40); j++) {
    const l = lines[j];
    if (/^#{1,6}\s/.test(l) || new RegExp(IMG.source).test(l)) break;
    const m = /^\s*(\d+)\.\s+(.*)$/.exec(l);
    if (m) { items.push({n: +m[1], ...parseItem(m[2])}); continue; }
    if (!items.length) continue;                       // still looking for the list ("図中の番号に対応する注釈：")
    if (l.trim() === '') { if (!/^\s*\d+\.\s/.test(lines.slice(j + 1).find(x => x.trim()) ?? '')) break; continue; }
    if (!/^\s{2,}\S/.test(l)) break;                   // a line that is not part of the item ends the list
  }
  return items;
}

export function parseItem(raw: string): {title: string; text: string} {
  const m = /^\*\*(.+?)\*\*\s*[：:]\s*(.*)$/.exec(raw);
  return m ? {title: m[1], text: m[2]} : {title: '', text: raw};
}

// notes: the figure's own  [string | {title?, text, n?}]
export function compareNotes(items: DocNoteItem[], notes: WfNote[], where: string): Finding[] {
  const out: Finding[] = [];
  const want = notes.map((nt, i) => (typeof nt === 'string' ? {n: i + 1, title: '', text: nt} : {n: nt.n ?? i + 1, title: nt.title ?? '', text: nt.text ?? ''}));
  if (!items.length) return [{rule: 'doc-notes-missing', severity: 'warn', message: `${where}: 図に注釈が ${want.length} 件あるが、直後に番号つきの注釈のリストがない（スクリーンリーダー向けの説明にもなる）`}];
  if (items.length !== want.length) out.push({rule: 'doc-notes-mismatch', severity: 'warn', message: `${where}: 注釈の数が違う（文書 ${items.length} 件 / 図 ${want.length} 件）`});
  for (const w of want) {
    const it = items.find(x => x.n === w.n);
    if (!it) { out.push({rule: 'doc-notes-mismatch', severity: 'warn', message: `${where}: 図の注釈 ${w.n}「${w.title || w.text.slice(0, 12)}」が文書にない`}); continue; }
    if (norm(it.title) !== norm(w.title)) out.push({rule: 'doc-notes-mismatch', severity: 'warn', message: `${where}: 注釈 ${w.n} の題名が違う（文書「${it.title}」/ 図「${w.title}」）`});
    else if (norm(it.text) !== norm(w.text)) out.push({rule: 'doc-notes-mismatch', severity: 'warn', message: `${where}: 注釈 ${w.n}「${w.title}」の本文が違う（文書「${it.text.slice(0, 24)}…」/ 図「${w.text.slice(0, 24)}…」）`});
  }
  return out;
}

// every wireframe's notes in a diagram (bands may be nested in groups); only a single set can be matched to one list
export function notesOf(bands: Band[]): WfNote[][] {
  const sets: WfNote[][] = [];
  const walk = (bs: Band[]): void => { for (const b of bs) { if (b.type === 'wireframe' && b.notes?.length) sets.push(b.notes); if (b.type === 'group') walk(b.children); } };
  walk(bands);
  return sets;
}
