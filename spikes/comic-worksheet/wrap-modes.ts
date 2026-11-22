// node spikes/comic-worksheet/wrap-modes.ts — the round-2 glue question: how much of the hiragana after a slot stays with it?
// Nine ordinary templates (an author or an LLM writes these) x three rules; bubble width, lines, and breaks inside a hiragana run.
import {measureWithFonts} from '../../lib/font-metrics.ts';
import {layoutComic, type GlueMode} from './proto.ts';
const hb = (t: string, s: number, w = 400) => measureWithFonts(new Map([['k', {text: t, size: s, weight: w, font: 'sans' as const}]])).get('k')!.w;
export const NINE: [string, number][] = [
  ['先に{p}しておきます。', 6], ['{p}しておきます。', 6], ['明日までに{p}をお願いしてもいいですか？', 6], ['{p}だと思っているんですけど…', 6],
  ['最近、{p}ですね。', 9], ['{p}してもらえると助かります。', 9], ['ちょっと{p}かもしれません。', 4], ['{p}', 9], ['今日は{p}の予定があるので、先に帰ります。', 9]];
const hira = (c?: string) => !!c && /[ぁ-ゟ]/.test(c);
const rows: string[] = [];
// baseline: the same sentence with the blank written as `max` literal kanji (nothing to glue): what plain `bunsetsu` does with it
for (const [tpl, max] of NINE) {
  const ws = {panels: [{id: 'p1', chars: [{id: 'me', side: 'left' as const, face: 'smile' as const, hue: 10}], lines: [{speaker: 'me', kind: 'say' as const, tpl: tpl.replace('{p}', '漢'.repeat(max))}]}]};
  const l = layoutComic(ws, hb), w = Object.values(l.wrapped)[0]!, b = Object.values(l.geometry.bubbles)[0]!;
  rows.push(`literal  ${String(b.w).padStart(3)}x${b.h}  ${w.lines.join(' / ')}`);
}
const total: Record<string, {wide: number; split: number; afterSlot: number; sumW: number}> = {};
for (const mode of ['all', 'two', 'particle', 'fit2', 'fit2p', 'fit2q'] as GlueMode[]) for (const [tpl, max] of NINE) {
  const ws = {panels: [{id: 'p1', chars: [{id: 'me', side: 'left' as const, face: 'smile' as const, hue: 10}], lines: [{speaker: 'me', kind: 'say' as const, tpl, slots: {p: {max, prompt: 'ほげ'}}}]}]};
  const l = layoutComic(ws, hb, {glue: mode}), w = Object.values(l.wrapped)[0]!, b = Object.values(l.geometry.bubbles)[0]!;
  // a break inside a run of hiragana: the line before ends in a hiragana (or a slot) and the next starts with a hiragana, and the break is not after 、。
  let split = 0, afterSlot = 0; w.lines.forEach((x, i) => { const prev = w.lines[i - 1]; if (prev && hira(x[0])) { if (hira(prev.at(-1))) split++; else if (prev.endsWith('}')) afterSlot++; } });
  const t = (total[mode] ??= {wide: 0, split: 0, afterSlot: 0, sumW: 0}); t.wide += b.w > 188 ? 1 : 0; t.split += split; t.afterSlot += afterSlot; t.sumW += b.w;
  rows.push(`${mode.padEnd(8)} ${String(b.w).padStart(3)}x${b.h}  run-split ${split} after-slot ${afterSlot}  ${w.lines.join(' / ')}  [${tpl}]`);
}
console.log(rows.join('\n')); console.log(JSON.stringify(total));
