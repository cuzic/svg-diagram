// S2 proxy (LibreOffice, reference only): per box, does the rendered text have as many lines as LaidOutBox.wrappedRuns says?
// Words (pdftotext -bbox) are assigned to the box whose rectangle holds their centre; lines are clusters of word centres in y.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {register} from 'node:module';
import {closeMeasurer} from '../../lib/measure.ts';
import {loadLaidOut} from './run.ts';
register(new URL('../../lib/resolve-hook.ts', import.meta.url));
const pdfDir = process.argv[2]!;
interface W {x0: number; y0: number; x1: number; y1: number}
let boxes = 0, equal = 0, more = 0, less = 0, noText = 0;
const bad: string[] = [];
for (const f of fs.readdirSync('examples').filter(f => f.endsWith('.ts')).sort()) {
  const {laidOut} = await loadLaidOut(path.join('examples', f));
  const xml = execFileSync('pdftotext', ['-bbox', path.join(pdfDir, f.replace(/\.ts$/, '.pdf')), '-'], {encoding: 'utf8'});
  const words: W[] = [...xml.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">/g)].map(m => ({x0: +m[1]!, y0: +m[2]!, x1: +m[3]!, y1: +m[4]!}));
  const PT = 0.75;
  // every box rectangle on the page: a caption's overflow is counted only where no other box is
  const rects: any[] = [];
  for (const b of laidOut.laidOut as any[]) { if (b.type === 'box' || b.type === 'banner') rects.push(b); else if (b.type === 'row' || b.type === 'grid') rects.push(...b.children); }
  const inAnother = (w: W, self: any): boolean => rects.some(r => r !== self && (w.x0 + w.x1) / 2 / PT >= r.x && (w.x0 + w.x1) / 2 / PT <= r.x + r.w && (w.y0 + w.y1) / 2 / PT >= r.y && (w.y0 + w.y1) / 2 / PT <= r.y + r.h);
  const check = (b: any, what: string): void => {
    const exp = (b.wrappedRuns ?? []).reduce((n: number, r: any) => n + r.lines.filter((l: string) => l.trim()).length, 0);
    if (!exp) return;
    const inside = words.filter(w => { const cx = (w.x0 + w.x1) / 2 / PT, cy = (w.y0 + w.y1) / 2 / PT; return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h + (what === 'caption' ? 40 : 0) && !(what === 'caption' && inAnother(w, b)); });
    const ys = inside.map(w => (w.y0 + w.y1) / 2).sort((a, c) => a - c);
    const hs = inside.length ? Math.min(...inside.map(w => w.y1 - w.y0)) : 0;
    let got = 0, last = -1e9;
    for (const y of ys) { if (y - last > hs * 0.6) got++; last = y; }
    boxes++;
    if (!inside.length) { noText++; bad.push(`${f} ${what}: no text rendered (expected ${exp})`); return; }
    if (got === exp) equal++; else { got > exp ? more++ : less++; bad.push(`${f} ${what} (${Math.round(b.w)}x${Math.round(b.h)}): expected ${exp}, rendered ${got}: ${JSON.stringify(b.wrappedRuns[0]?.lines[0])}`); }
  };
  for (const b of laidOut.laidOut as any[]) {
    if (b.type === 'box' || b.type === 'banner' || b.type === 'caption') check(b, b.type);
    else if (b.type === 'row' || b.type === 'grid') b.children.forEach((c: any) => check(c, b.type + '-child'));
  }
}
console.log({boxes, equal, rendered_more_lines: more, rendered_fewer: less, noText});
console.log(bad.slice(0, 30).join('\n'));
closeMeasurer();
