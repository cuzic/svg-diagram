import {fromSources} from './finding-rules.ts';
import {sourceOf} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import type {Band} from './types/index.ts';
import type {Finding} from './types/verdicts.ts';

// string fields that are text a reader sees (a connect()'s from / to and every id are not)
const TEXT_KEYS: ReadonlySet<string> = new Set(['title', 'body', 'label', 'text', 'caption', 'note', 'name', 'headline', 'sub', 'subtitle', 'tag', 'heading', 'lead', 'stamp', 'sourceLine', 'items', 'cells', 'rows', 'detail', 'desc']);

function locatedTexts(bands: readonly Band[]): {text: string; loc?: SourceRef}[] {
  const out: {text: string; loc?: SourceRef}[] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, text: boolean, parent?: SourceRef): void => {
    if (typeof v === 'string') { if (text && v.trim()) out.push({text: v, loc: parent}); return; }
    if (typeof v !== 'object' || v === null || seen.has(v)) return;
    seen.add(v);
    const loc = sourceOf(v) ?? parent;
    if (Array.isArray(v)) { for (const x of v) walk(x, text, loc); return; }
    for (const [k, x] of Object.entries(v)) walk(x, TEXT_KEYS.has(k), loc);
  };
  walk(bands, false);
  return out;
}

/** The strings of a diagram's bands that are meant to be read (labels, titles, bodies, table cells). */
export function textsOf(bands: readonly Band[]): string[] {
  return locatedTexts(bands).map(t => t.text);
}

const KATAKANA = /[ァ-ヴー]{3,}/g;
const LATIN = /(?<![A-Za-z0-9_-])[A-Za-z]{3,}(?![A-Za-z0-9_-])/g; // words only: an id or a code with digits, - or _ (a12, aws-s3) is not a term
// all-lowercase and Capitalised are the same class (a word at the start of a sentence); ALLCAPS and camelCase are different classes
const caseClass = (w: string): string => w === w.toUpperCase() ? 'upper' : w === w.toLowerCase() || w === (w[0] ?? '').toUpperCase() + w.slice(1).toLowerCase() ? 'plain' : 'mixed';

/** Spellings of one term that differ only by a trailing long vowel mark or by letter case class, inside one diagram. */
export function termVariants(texts: readonly string[]): string[][] {
  const kana = new Map<string, Set<string>>(), latin = new Map<string, Map<string, string>>();
  for (const t of texts) {
    for (const m of t.matchAll(KATAKANA)) { const k = m[0].replace(/ー+$/, ''); if (k.length >= 3) kana.set(k, (kana.get(k) ?? new Set()).add(m[0])); }
    for (const m of t.matchAll(LATIN)) { const k = m[0].toLowerCase(); const byClass = latin.get(k) ?? new Map<string, string>(); if (!byClass.has(caseClass(m[0]))) byClass.set(caseClass(m[0]), m[0]); latin.set(k, byClass); }
  }
  return [...[...kana.values()].filter(s => s.size > 1).map(s => [...s].sort()), ...[...latin.values()].filter(m => m.size > 1).map(m => [...m.values()].sort())];
}

/** `terms`: {"ユーザー": ["利用者", "ユーザ"]} — the preferred word and the spellings that should not appear. */
export function termFindings(bands: readonly Band[], terms: Readonly<Record<string, readonly string[]>> | undefined): Finding[] {
  const texts = locatedTexts(bands), out: Finding[] = [];
  const variants = termVariants(texts.map(t => t.text)).filter(v => !terms || !Object.entries(terms).some(([p, avoid]) => v.every(w => w === p || avoid.includes(w)))); // the glossary says it better
  const wordRefs = new Map<string, Set<SourceRef>>();
  if (variants.length) for (const {text, loc} of texts) {
    if (!loc) continue;
    for (const [word] of [...text.matchAll(KATAKANA), ...text.matchAll(LATIN)]) {
      const refs = wordRefs.get(word) ?? new Set();
      refs.add(loc);
      wordRefs.set(word, refs);
    }
  }
  for (const v of variants) out.push({...fromSources(v.flatMap(word => [...(wordRefs.get(word) ?? [])])), rule: 'term-variant', severity: 'warn', message: `同じ語の表記が揺れている: ${v.map(w => `「${w}」`).join(' と ')}。どちらかに揃える（揃える語を .svg-diagram.json の "terms" に書くと、全ての図で見張る）`});
  for (const [prefer, avoid] of Object.entries(terms ?? {})) {
    const refs = new Set<SourceRef | undefined>();
    const hit = avoid.filter(a => {
      if (!a) return false;
      const matches = texts.filter(t => t.text.toLowerCase().includes(a.toLowerCase()));
      for (const {loc} of matches) refs.add(loc);
      return matches.length > 0;
    });
    if (hit.length) out.push({...fromSources(refs), rule: 'term-avoid', severity: 'warn', message: `${hit.map(a => `「${a}」`).join('、')} は用語集で「${prefer}」に統一する語`});
  }
  return out;
}
