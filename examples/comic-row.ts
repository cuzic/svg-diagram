// 横 4×1 のマンガ。コマの幅は図の幅(canvas: 'slide' なら 1280px のスライドいっぱい)を列で割って決まるので、幅の指定は要らない。fontSize でふきだしの文字を大きくできる(既定 18)。
// スライドの文字の下限(24px)を満たすため、番号札(14 × fontSize / 18 px)を出さず(numbering: false)、穴は下線だけ(blank: 'line')にしている。
// ビルド: svg-diagram build examples/comic-row.ts --out examples/out/comic-row.svg
import {comic, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '雨の日の通勤', canvas: 'slide', legend: false}).add(comic({
    version: 1,
    title: '雨の日の通勤',
    layout: '4x1',
    numbering: false,
    blank: 'line',
    cast: {me: {name: '私'}, fr: {name: '友人'}},
    panels: [
      {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'fr', at: 'right', expression: 'smile'}],
        dialogue: [{id: 'd1', who: 'fr', kind: 'say', tpl: '今日は{weather}だね。', slots: {weather: {max: 3, prompt: '天気'}}}]},
      {id: 'p2', stage: [{who: 'me', at: 'left', expression: 'worry'}, {who: 'fr', at: 'right', expression: 'neutral'}],
        dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: '{item}を忘れた…。', slots: {item: {max: 3, prompt: '持ち物'}}}]},
      {id: 'p3', stage: [{who: 'me', at: 'left', expression: 'surprise'}, {who: 'fr', at: 'right', expression: 'laugh'}],
        dialogue: [{id: 'd1', who: 'fr', kind: 'say', tpl: '貸すよ。一緒に入ろう。'}]},
      {id: 'p4', stage: [{who: 'me', at: 'left', expression: 'smile'}, {who: 'fr', at: 'right', expression: 'smile'}],
        dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: '今度は{thing}ね。', slots: {thing: {max: 4, prompt: 'お礼'}}}]},
    ],
  }, {fontSize: 24}));
}
