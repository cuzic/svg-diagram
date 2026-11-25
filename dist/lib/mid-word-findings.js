import { fromSources } from './finding-rules.js';
import { must } from './must.js';
import { midWordBreaksIn, sourceText } from './text-rules.js';
import { fullWidthUnits } from './verify-caption.js';
/** How to fix a mid-word break depends on whether the part's boxes can be widened: a chevron / cycle / swimlane fixes the frame first. */
const MID_WORD_FIX = {
    chevron: "矢羽根の幅は段数で決まる。`direction: 'vertical'` にする、段を減らす、文言を短くする",
    valueChain: '矢羽根の幅は主活動の数で決まる。主活動を減らす、文言を短くする、マージンの矢印を外す（`margin: false`）',
    cycle: '円は、カタカナの語に合わせて幅・高さの上限（幅 −8px、高さ 760px）まで広がる。それでも入らない語は、文言を短くする、項目を減らす',
    swimlane: "列の幅は段数で決まる。`fit: 'shrink'` を外す、列を減らす、文言を短くする",
    emblem: "図形は語が割れない大きさまで 240px を上限に広がる。それでも割れる語は、`minSize` を上げる、`shape: 'square'` にする、文言を短くする（320px まで広がっても入らなければ throw する）",
};
export function midWordFindings(d) {
    const source = sourceText(d.bands);
    const refs = new Set();
    const found = (d.laidOut ?? []).flatMap(b => midWordBreaksIn(b, source, ref => refs.add(ref)).map(br => ({ type: String(b.type), ...br })));
    if (!found.length)
        return [];
    const shown = [...new Set(found.map(b => `「${b.before}/${b.after}」`))];
    // the word that was cut, and how wide a line has to be for it (full-width characters): the box must be at least that wide
    const words = [...new Map(found.filter(b => b.word).map(b => [b.word, fullWidthUnits(b.word)]))].sort((p, q) => q[1] - p[1]);
    const wordNote = words.length ? ` 割れた語: ${words.slice(0, 3).map(([w, u]) => `「${w}」（全角で約 ${Math.ceil(u)} 字分）`).join('')}。その語が 1 行に入る幅（文字の大きさ × ${Math.ceil(must(words[0])[1])} 字分以上）が箱に要る。` : '';
    const fixes = [...new Set(found.flatMap(b => MID_WORD_FIX[b.type] ? [`${b.type}: ${MID_WORD_FIX[b.type]}`] : []))];
    return [{ ...fromSources(refs), rule: 'text-mid-word-break', severity: 'warn', message: `語の途中で行が割れている（${shown.slice(0, 4).join('')}${shown.length > 4 ? ` ほか ${shown.length - 4} 件` : ''}）。${wordNote}直し方: ${fixes.length ? fixes.join('。') : 'diagram({keepWords: true}) で語を割らない、箱の幅を広げる、dir や maxNodeW を変える、文言を短くする、語の前後で改行する'}` }];
}
