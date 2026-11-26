// マンガと同じワークシート(コマの台詞)をチャットにする。コマの順に台詞をつなぎ、separators: true でコマの境に細い線を引く。
// ビルド: svg-diagram build examples/chat-sheet.ts --out examples/out/chat-sheet.svg
import {chat, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '週に一度は早く帰る', width: 520, legend: false}).add(chat({
    version: 1,
    title: '週に一度は早く帰る',
    layout: '1x2',
    cast: {me: {name: '私'}, col: {name: '同僚'}},
    panels: [
      {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'col', at: 'right', expression: 'smile'}],
        dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: '今週から、毎週{day}は定時で上がります。', slots: {day: {max: 3, prompt: '曜日'}}}]},
      {id: 'p2', stage: [{who: 'me', at: 'left', expression: 'smile'}, {who: 'col', at: 'right', expression: 'surprise'}],
        dialogue: [
          {id: 'd1', who: 'col', kind: 'say', tpl: 'えっ、{what}は大丈夫なの？', slots: {what: {max: 6, prompt: '心配'}}},
          {id: 'd2', who: 'me', kind: 'say', tpl: '先に{prep}しておきます。', slots: {prep: {max: 6, prompt: '準備'}}},
        ]},
    ],
  }, {separators: true}));
}
