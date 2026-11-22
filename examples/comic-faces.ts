// 内蔵の顔(8 つの表情、髪型 2 種、色相)と、絵師の素材(`characters`)を使うマンガ。素材は 1 つの JSON(箱・アンカー・表情ごとの断片・ライセンス)。
// 例の素材と人物はこの例のための作り話。
// ビルド: svg-diagram build examples/comic-faces.ts --out examples/out/comic-faces.svg
import {comic, diagram} from 'svg-diagram';
import type {CharacterManifest} from 'svg-diagram';

const face = (mouth: string) => '<defs><linearGradient id="cloth"><stop offset="0" stop-color="#4a6fa5"/><stop offset="1" stop-color="#2d4a73"/></linearGradient></defs>'
  + '<rect x="30" y="140" width="140" height="100" fill="url(#cloth)" stroke="#22201b" stroke-width="3"/>'
  + '<circle cx="100" cy="90" r="56" fill="#f1e3d3" stroke="#22201b" stroke-width="3"/>'
  + '<circle cx="78" cy="84" r="5" fill="#22201b"/><circle cx="122" cy="84" r="5" fill="#22201b"/>' + mouth;
const robot: CharacterManifest = {
  id: 'robot', name: 'ロボ', box: [0, 0, 200, 240],
  anchors: {head: {cx: 100, cy: 90, r: 56}, mouth: [100, 112], hand: [150, 190]},
  bubbleSides: ['top-left', 'top', 'top-right'],
  expressions: {
    neutral: face('<path d="M82 114h36" fill="none" stroke="#22201b" stroke-width="4"/>'),
    smile: face('<path d="M80 108q20 18 40 0" fill="none" stroke="#22201b" stroke-width="4"/>'),
  },
  license: {spdx: 'CC0-1.0', author: 'この例のための作り話', url: 'https://example.com/characters/robot'},
};

const pair = (id: string, a: 'neutral' | 'smile' | 'laugh' | 'surprise', b: 'worry' | 'angry' | 'think' | 'sad' | 'smile') => ({id, stage: [
  {who: 'me', at: 'left' as const, expression: a}, {who: 'bot', at: 'right' as const, expression: b === 'smile' ? 'smile' as const : 'neutral' as const}], dialogue: []});

export default function define() {
  return diagram({theme: 'blue', title: '内蔵の顔と絵師の素材', width: 800, legend: false}).add(comic({
    version: 1,
    title: '内蔵の顔と絵師の素材',
    layout: '2x2',
    cast: {me: {name: '私', face: {hue: 210, hair: 'long'}}, bot: {name: 'ロボ', asset: 'robot'}, col: {name: '同僚', face: {hue: 20}}},
    panels: [
      pair('p1', 'neutral', 'smile'),
      pair('p2', 'laugh', 'smile'),
      {id: 'p3', stage: [{who: 'col', at: 'left', expression: 'surprise'}, {who: 'me', at: 'right', expression: 'worry'}], dialogue: []},
      {id: 'p4', stage: [{who: 'col', at: 'left', expression: 'angry'}, {who: 'me', at: 'right', expression: 'sad'}, {who: 'bot', at: 'center', expression: 'smile'}], dialogue: []},
    ],
  }, {characters: {robot}}));
}
