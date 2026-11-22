// 縦 1×4 のマンガ。台詞は意味が先のデータ(テンプレートと穴 {…})で、コマ・人物・ふきだしの位置は決まりから出る。穴は空のまま(案内つき)。
// ビルド: svg-diagram build examples/comic-column.ts --out examples/out/comic-column.svg
import {comic, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '週に一度は早く帰る', width: 480, legend: false}).add(comic({
    version: 1,
    title: '週に一度は早く帰る',
    layout: '1x4',
    cast: {me: {name: '私'}, col: {name: '同僚'}},
    panels: [
      {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'col', at: 'right', expression: 'smile'}],
        dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: '今週から、毎週{day}は定時で上がります。', slots: {day: {max: 3, prompt: '曜日'}}}]},
      {id: 'p2', stage: [{who: 'me', at: 'left', expression: 'smile'}, {who: 'col', at: 'right', expression: 'surprise'}],
        dialogue: [
          {id: 'd1', who: 'col', kind: 'say', tpl: 'えっ、{what}は大丈夫なの？', slots: {what: {max: 6, prompt: '心配'}}},
          {id: 'd2', who: 'me', kind: 'say', tpl: '先に{prep}しておきます。', slots: {prep: {max: 6, prompt: '準備'}}},
        ]},
      {id: 'p3', stage: [{who: 'me', at: 'left', expression: 'think'}, {who: 'col', at: 'right', expression: 'worry'}],
        dialogue: [
          {id: 'd1', who: 'col', kind: 'say', tpl: '最近、{change}ね。', slots: {change: {max: 8, prompt: '変化'}}},
          {id: 'd2', who: 'me', kind: 'think', tpl: '見られているのかも…'},
        ]},
      {id: 'p4', stage: [{who: 'me', at: 'left', expression: 'laugh'}, {who: 'col', at: 'right', expression: 'laugh'}],
        dialogue: [{id: 'd1', who: 'col', kind: 'say', tpl: '{wish}、いいと思う！', slots: {wish: {max: 8, prompt: 'ひとこと'}}}]},
    ],
  }));
}
