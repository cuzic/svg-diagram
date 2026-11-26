// チャット画面の図。同じ台詞のデータ(テンプレートと穴 {…})を縦に積み、自分(me)は右、相手は左に丸い顔と名前つきで描く。下に入力欄(input)も出せる。
// ビルド: svg-diagram build examples/chat-draft.ts --out examples/out/chat-draft.svg
import {chat, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '案内文の下書き', width: 520, legend: false}).add(chat({
    version: 1,
    title: '案内文の下書き',
    cast: {me: {name: '私'}, ai: {name: 'アシスタント'}},
    dialogue: [
      {id: 'ask', who: 'me', kind: 'say', tpl: '来週の{event}の案内文を作ってください。', slots: {event: {max: 6, prompt: '行事'}}},
      {id: 'ok', who: 'ai', kind: 'say', tpl: '承知しました。いただいた内容から、参加者に向けた短い案内文の下書きを作ります。'},
      {id: 'draft', who: 'ai', kind: 'say', tpl: 'みなさん、来週の集まりにぜひご参加ください。'},
      {id: 'reply', who: 'me', kind: 'say', tpl: '日時は{day}でお願いします。', slots: {day: {max: 6, prompt: '日時'}}},
    ],
  }, {input: '指示を入力'}));
}
