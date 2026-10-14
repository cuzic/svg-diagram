// What changed between two generated SVGs? (e.g. after upgrading the tool, or editing a part)
// A short, human summary — "metadata only" is very different from "the text moved".

import type {ChangeExplanation} from './types/project.ts';

const strip = (s: string): string => s.replace(/<metadata[\s\S]*?<\/metadata>/g, '');
const metaOf = (s: string): string => (s.match(/<metadata[^>]*>([\s\S]*?)<\/metadata>/) ?? [])[1] ?? '';
const elementsOf = (s: string): string[] => [...strip(s).matchAll(/<(text|rect|circle|ellipse|path|line|polygon)\b[^>]*?(?:\/>|>[^<]*<\/\1>)/g)].map(m => m[0]);
const isInvisible = (e: string): boolean => /fill-opacity="0"/.test(e);
const textKey = (e: string): string => (e.match(/>([^<]*)</) ?? [])[1] ?? '';
const size = (s: string): string => (s.match(/<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/) ?? []).slice(1).join('x');

function diffMultiset(a: string[], b: string[]): {added: string[]; removed: string[]} {
  const count = new Map<string, number>();
  for (const x of a) count.set(x, (count.get(x) ?? 0) + 1);
  const added: string[] = [];
  for (const x of b) { const c = count.get(x) ?? 0; if (c > 0) count.set(x, c - 1); else added.push(x); }
  const removed: string[] = [];
  for (const [x, c] of count) for (let i = 0; i < c; i++) removed.push(x);
  return {added, removed};
}

export function explainChange(oldSvg: string, newSvg: string): ChangeExplanation {
  if (oldSvg === newSvg) return {identical: true, visual: false, lines: ['同一']};
  const lines: string[] = [];
  const {added, removed} = diffMultiset(elementsOf(oldSvg), elementsOf(newSvg));
  const addVis = added.filter(e => !isInvisible(e)), remVis = removed.filter(e => !isInvisible(e));
  const addInv = added.length - addVis.length, remInv = removed.length - remVis.length;
  // texts with the same content that only moved
  const texts = (arr: string[]) => arr.filter(e => e.startsWith('<text'));
  const remText = texts(remVis), addText = texts(addVis), moved: string[] = [];
  for (const r of [...remText]) {
    const k = addText.findIndex(a => textKey(a) === textKey(r));
    if (k >= 0) { moved.push(textKey(r)); addText.splice(k, 1); remText.splice(remText.indexOf(r), 1); }
  }
  const shapesAdd = addVis.filter(e => !e.startsWith('<text')).length, shapesRem = remVis.filter(e => !e.startsWith('<text')).length;
  if (size(oldSvg) !== size(newSvg)) lines.push(`キャンバスの大きさ: ${size(oldSvg)} → ${size(newSvg)}`);
  if (moved.length) lines.push(`文字の移動: ${moved.length} 件（${moved.slice(0, 3).map(t => `「${t.slice(0, 10)}」`).join('')}${moved.length > 3 ? ' ほか' : ''}）`);
  if (addText.length || remText.length) lines.push(`文字の増減: +${addText.length} / -${remText.length}（${[...addText, ...remText].slice(0, 3).map(e => `「${textKey(e).slice(0, 10)}」`).join('')}${addText.length + remText.length > 3 ? ' ほか' : ''}）`);
  if (shapesAdd || shapesRem) lines.push(`図形の増減: +${shapesAdd} / -${shapesRem}`);
  const visual = lines.length > 0;
  if (addInv || remInv) lines.push(`不可視の下地（見た目に影響しない）: +${addInv} / -${remInv}`);
  if (strip(oldSvg) === strip(newSvg) || (!visual && !addInv && !remInv)) {
    if (metaOf(oldSvg) !== metaOf(newSvg)) lines.push('メタデータのみ（生成元の情報、ツールの版）');
  } else if (metaOf(oldSvg) !== metaOf(newSvg)) lines.push('メタデータも変更');
  return {identical: false, visual, lines};
}
