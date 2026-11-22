// 2×2 のマンガ(印刷の A4 向き)。コマは左から右へ、行ごとに読む。ナレーション(しっぽなし)・思い・叫びのふきだしも使う。穴は `blank: 'line'` で下線だけ。
// ビルド: svg-diagram build examples/comic-grid.ts --out examples/out/comic-grid.svg
import {comic, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '報告のあとで', width: 800, legend: false}).add(comic({
    version: 1,
    title: '報告のあとで',
    layout: '2x2',
    blank: 'line',
    labels: ['起', '承', '転', '結'],
    cast: {mgr: {name: '課長'}, me: {name: '私'}},
    panels: [
      {id: 'k', bg: {tint: 'warm'}, stage: [{who: 'mgr', at: 'left', expression: 'neutral'}, {who: 'me', at: 'right', expression: 'worry'}],
        dialogue: [
          {id: 'n1', kind: 'narration', tpl: '月曜の朝。'},
          {id: 'd1', who: 'mgr', kind: 'say', tpl: '先週の{topic}、どうなった？', slots: {topic: {max: 4, prompt: '案件'}}},
        ]},
      {id: 's', stage: [{who: 'mgr', at: 'left', expression: 'neutral'}, {who: 'me', at: 'right', expression: 'think'}],
        dialogue: [{id: 'd1', who: 'me', kind: 'think', tpl: '{reason}と言うしかない…', slots: {reason: {max: 6, prompt: '理由'}}}]},
      {id: 't', bg: {tint: 'cool'}, stage: [{who: 'mgr', at: 'left', expression: 'surprise'}, {who: 'me', at: 'right', expression: 'smile'}],
        dialogue: [{id: 'd1', who: 'mgr', kind: 'shout', tpl: 'もう終わったの！？'}]},
      {id: 'k2', stage: [{who: 'mgr', at: 'left', expression: 'laugh'}, {who: 'me', at: 'right', expression: 'laugh'}],
        dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: '次は{next}です。', slots: {next: {max: 4, prompt: '予定'}}}]},
    ],
  }));
}
