import {diagram, mindmap} from 'svg-diagram';

// 「今ここ」: focus に渡したノードを塗り、その先と中心までの道を強調色、ほかの枝を薄くする（章の頭に同じ図を繰り返し出す）。
export default function define() {
  return diagram({theme: 'blue', title: '研修の全体像（今ここ: 選択肢）'}).add(
    mindmap({
      label: '意思決定の研修', id: 'root',
      children: [
        {label: 'なぜ', id: 'why', children: [{label: '詰まっているのは決定', id: 'why1'}]},
        {label: 'いつ', id: 'when', children: [{label: '今決める・後で決める', id: 'when1'}]},
        {label: '6つの条件', id: 'dq', children: [{label: '問い', id: 'q'}, {label: '選択肢', id: 'opt'}, {label: '情報', id: 'info'}]},
        {label: '渡し方', id: 'hand', children: [{label: '何を・どう・どこまで', id: 'hand1'}]},
      ],
    }, {focus: 'opt', sides: {why: 'left', when: 'left'}}),
  );
}
