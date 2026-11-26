import {at, findingAcceptanceHint} from '../finding-rules.ts';
import type {ComicFinding} from '../types/comic.ts';
import type {Finding} from '../types/verdicts.ts';

export const comicRuleDocs = {
  'comic-bubble-wide': {scope: 'band', doc: 'マンガ(comic)のふきだしの文が、全角 11 字(内側 198px)より広い(穴の長さ + 後ろのひらがな、または語が長い)。穴を短くするか、ひらがなを減らす'},
  'comic-orphan-line': {scope: 'band', doc: 'マンガ(comic)のふきだしの最後の行が 2 字以下(「…」「ね。」)。広げても直らなかった。台詞を言い換えて、最後の行を長くするか前の行に収める'},
  'comic-follower-split': {scope: 'band', doc: 'マンガ(comic)のふきだしで、穴の後ろのひらがなの連なり(3 字以下)が穴から切り離されている(助詞が次の行に回る、連なりの途中で割れる)。穴と一緒の行に収まるように言い換える'},
  'comic-value-invalid': {scope: 'band', doc: 'マンガの穴の値が空白だけ、複数行、制御文字を含む、最大字数を超える、または指定された候補にない。穴の規則に合う値を入力する'},
  'comic-values-unknown': {scope: 'band', doc: 'マンガの穴の定義にない id が values にある。定義済みの穴の id を使う'},
  'slot-overflow': {scope: 'band', doc: 'マンガの穴の文字が 14px でも収まらず、穴の矩形で切れる。穴の値や飛ばしの文言を短くする'},
} as const;

export function comicAcceptHint(rule: string): string | undefined {
  return Object.hasOwn(comicRuleDocs, rule) ? findingAcceptanceHint(rule) : undefined;
}

/** Fold layout diagnostics into the diagram verdict. Filled values are checked by renderComic. */
export function comicProblems(band: {findings: readonly ComicFinding[]}, label = 'comic') {
  return band.findings.filter(f => f.severity === 'problem').map(f => ({
    rule: f.rule, severity: 'problem' as const, message: `${label}: ${f.message} [${f.rule}]`,
  }));
}

export function comicAdvice(band: {findings: readonly ComicFinding[]}): Finding[] {
  return band.findings.filter(f => f.severity === 'advice').map(f => ({
    ...at(band), rule: f.rule, severity: 'warn', message: f.message,
  }));
}
