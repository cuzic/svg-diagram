// Documents <-> diagrams: do the Markdown pages and the generated SVGs still agree?
// Pure string work (no browser), so it can run anywhere and be unit-tested.
//
//   scanMarkdown(text)            every  ![alt](...svg)  in a page, with the numbered list that follows it
//   parseItem(raw)                "**title**：text"  ->  {title, text}
//   compareNotes(items, notes)    the list in the page vs the figure's own notes  ->  findings

import type {Band} from './types/index.ts';
import type {DocImage, DocCaption, DocNoteItem} from './types/project.ts';
import type {Finding} from './types/verdicts.ts';
import type {WfNote} from './types/wireframe.ts';

const IMG = /!\[([^\]]*)\]\(([^)\s]+\.svg)\)/g;
const PNG = /!\[([^\]]*)\]\(([^)\s]+\.png)\)/gi;
// every  ![alt](...png)  in a page (local or remote): the raster copies of figures, checked against the figure sources and the files on disk
export function scanPngRefs(text: string): {line: number; alt: string; ref: string}[] {
  const out: {line: number; alt: string; ref: string}[] = [];
  let fence = false;
  text.split('\n').forEach((ln, i) => {
    if (/^\s*(```|~~~)/.test(ln)) { fence = !fence; return; }
    if (!fence) for (const m of ln.matchAll(PNG)) out.push({line: i + 1, alt: m[1], ref: m[2]});
  });
  return out;
}
const norm = (s: unknown): string => String(s ?? '').replace(/\s+/g, '').replace(/：/g, ':');

export function scanMarkdown(text: string): DocImage[] {
  const lines = text.split('\n'), out: DocImage[] = [];
  lines.forEach((ln, i) => { for (const m of ln.matchAll(IMG)) out.push({line: i + 1, alt: m[1], ref: m[2], items: listAfter(lines, i), caption: captionOf(lines, i, m[1])}); });
  return out;
}

const FIG = '図\\s*(\\d+)\\s*[-－ー−‐]\\s*(\\d+)';
// a caption is 図N-M in the alt text, or at the start of the nearest non-blank line before/after the image (a mention inside a sentence is a reference, not a caption)
function captionOf(lines: string[], i: number, alt: string): DocCaption | undefined {
  const a = new RegExp(FIG).exec(alt);
  if (a) return {ch: +a[1], no: +a[2], line: i + 1};
  // 図N-M then a separator (space, colon, closing mark): "図3-1と同じく…" starts a sentence, it is not a caption
  const at = (j: number): DocCaption | undefined => {
    const m = new RegExp(`^[\\s*_>]*${FIG}(?=$|[\\s:：.．、。*_)）\\]】」])`).exec(lines[j]);
    return m ? {ch: +m[1], no: +m[2], line: j + 1} : undefined;
  };
  const near = (from: number, dir: number): number => {
    let j = from + dir;
    while (j >= 0 && j < lines.length && lines[j].trim() === '') j += dir;
    return j >= 0 && j < lines.length ? j : -1;
  };
  const isImg = (j: number) => j >= 0 && new RegExp(IMG.source).test(lines[j]);
  const after = near(i, 1), before = near(i, -1);
  const ca = after >= 0 && !isImg(after) ? at(after) : undefined, cb = before >= 0 && !isImg(before) ? at(before) : undefined;
  // captions above the figures: the line after this image sits right above the next image, so it is that image's caption
  if (ca && cb && isImg(near(after, 1))) return cb;
  return ca ?? cb;
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

// the figure's notes as the numbered list a page puts under it ("1. **題名**：本文") — paste-ready, and what compareNotes accepts
export function formatNotes(notes: WfNote[]): string {
  return notes.map((nt, i) => {
    const w = typeof nt === 'string' ? {n: i + 1, title: '', text: nt} : {n: nt.n ?? i + 1, title: nt.title ?? '', text: nt.text ?? ''};
    return `${w.n}. ${w.title ? `**${w.title}**：` : ''}${w.text.replace(/\s*\n\s*/g, ' ').trim()}`; // one line per item: a line break would end the list item
  }).join('\n');
}

// the chapter number a file name carries: "03-intro.md", "ch3.md", "chapter-03_x.md" -> 3
export function chapterOf(file: string): number | null {
  const m = /^(?:ch(?:apter)?[-_]?)?0*(\d{1,3})(?!\d)/i.exec(file.replace(/^.*[\\/]/, ''));
  return m ? +m[1] : null;
}

const PLACEHOLDER_ALT = /^(image|img|diagram|figure|fig\d*|picture|図|画像|図表|図解)$/i;
export interface DocFinding extends Finding {line?: number}
// figure numbering and prose in one page: captions 図N-M in order, a real alt text, and body references that point at a figure that exists
export function checkFigures(text: string, figs: DocImage[], chapter: number | null): DocFinding[] {
  const out: DocFinding[] = [];
  const caps = figs.filter(f => f.caption);
  let prev: DocCaption | null = null;
  const seen = new Set<string>();
  for (const f of figs) {
    const alt = f.alt.trim();
    if (alt && (PLACEHOLDER_ALT.test(alt) || alt.replace(/\.svg$/i, '') === f.ref.replace(/^.*\//, '').replace(/\.svg$/i, ''))) out.push({line: f.line, rule: 'doc-alt-placeholder', severity: 'warn', message: `代替テキストが「${alt}」のままで、図の内容を言っていない`});
    const c = f.caption;
    if (!c) continue;
    const label = `図${c.ch}-${c.no}`, key = `${c.ch}-${c.no}`;
    if (chapter !== null && c.ch !== chapter) out.push({line: c.line, rule: 'doc-fig-number', severity: 'warn', message: `${label}: 章番号がファイルの章（${chapter}）と違う`});
    else if (prev && prev.ch !== c.ch) out.push({line: c.line, rule: 'doc-fig-number', severity: 'warn', message: `${label}: 前の図（図${prev.ch}-${prev.no}）と章番号が違う`});
    if (seen.has(key)) out.push({line: c.line, rule: 'doc-fig-number', severity: 'warn', message: `${label} が重複している`});
    else if (prev && prev.ch === c.ch && c.no !== prev.no + 1) out.push({line: c.line, rule: 'doc-fig-number', severity: 'warn', message: `${label}: 図番号が連番でない（前は 図${prev.ch}-${prev.no}、次は 図${prev.ch}-${prev.no + 1} のはず）`});
    else if (!prev && c.no !== 1) out.push({line: c.line, rule: 'doc-fig-number', severity: 'warn', message: `${label}: 最初の図が 図${c.ch}-1 でない`});
    seen.add(key); prev = c;
  }
  for (const f of figs) {                         // the numbered notes under a figure count 1, 2, 3 ... (a gap hides a deleted note)
    const ns = f.items.map(i => i.n);
    if (ns.length && ns.some((n, k) => n !== k + 1) && !ns.every(n => n === 1)) out.push({line: f.line, rule: 'doc-notes-number', severity: 'warn', message: `図の下の注釈の番号が 1 から順でない（${ns.join(', ')}）`});
  }
  if (caps.length) {                              // 図N-M in a sentence must name a figure that has a caption in this page (references to other chapters are not checked)
    const have = new Set(caps.map(f => `${f.caption!.ch}-${f.caption!.no}`)), capLines = new Set(caps.map(f => f.caption!.line));
    let fence = false;
    text.split('\n').forEach((ln, k) => {
      if (/^\s*(```|~~~)/.test(ln)) { fence = !fence; return; }
      if (fence || capLines.has(k + 1)) return;
      for (const m of ln.replace(/`[^`]*`/g, '').matchAll(new RegExp(FIG, 'g'))) {   // `図3-9` in inline code is an example, not a reference
        const ch = +m[1], key = `${m[1]}-${m[2]}`;
        if (ch === (chapter ?? caps[0].caption!.ch) && !have.has(key)) out.push({line: k + 1, rule: 'doc-fig-ref-missing', severity: 'warn', message: `本文の「図${m[1]}-${m[2]}」に対応する図がこの文書にない`});
      }
    });
  }
  return out;
}

// --only globs: ** crosses folders, * and ? stay inside one; matched against the path relative to the current directory (and against the bare file name)
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') { if (glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; } else re += '[^/]*'; }
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
export const matchesAny = (globs: RegExp[], rel: string): boolean => !globs.length || globs.some(g => g.test(rel.replace(/\\/g, '/')) || g.test(rel.replace(/^.*[\\/]/, '')));

export interface MapRow {name: string; svg: string; doc: string; src: string}
// the figure <-> document table (Markdown); rows with no document are the orphans
export function formatMap(rows: MapRow[]): string {
  const cell = (s: string) => (s ? `\`${s}\`` : '—');
  const lines = ['| 図 | 図のソース | SVG | 使っている文書 |', '|---|---|---|---|'];
  for (const svg of [...new Set(rows.map(r => r.svg))].sort()) { // by path: two figures with the same file name in different folders stay apart
    const rs = rows.filter(r => r.svg === svg), name = rs[0].name;
    const docs = rs.map(r => r.doc).filter(Boolean);
    lines.push(`| ${name} | ${cell(rs[0].src)} | ${cell(rs[0].svg)} | ${docs.length ? docs.map(d => `\`${d}\``).join('<br>') : '（参照なし）'} |`);
  }
  return lines.join('\n');
}
