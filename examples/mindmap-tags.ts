import {diagram, mindmap} from 'svg-diagram';

// 項目の札: tags は箱の最上段に並ぶ色付きの札（最大 3 つ、1 つ 8 文字まで）。sub は別の情報に使い続けられる。
// 文字列は accent の札、{text, tone} で danger（反対）や muted（保留）にする。内容は作り話。
export default function define() {
  return diagram({theme: 'blue', title: '新しい勤怠システムを導入するか'}).add(
    mindmap({
      label: '新しい勤怠システムを導入するか', id: 'root',
      children: [
        {label: '賛成の理由', id: 'pro', children: [
          {label: '集計の手間が減る', tags: [{text: '決定', tone: 'accent'}], sub: '月末の作業が半日→1時間'},
          {label: '打刻の漏れがなくなる', tags: ['要確認']},
        ]},
        {label: '反対の理由', id: 'con', children: [
          {label: '移行に時間がかかる', tags: [{text: '反対', tone: 'danger'}, {text: '要確認', tone: 'muted'}]},
          {label: '費用が見合わない', tags: [{text: '反対', tone: 'danger'}], sub: '年間の利用料が現行の2倍'},
        ]},
        {label: '次にやること', id: 'next', children: [
          {label: '現場に聞き取りをする', tags: ['宿題']},
          {label: '他社の導入例を調べる', tags: [{text: '保留', tone: 'muted'}]},
        ]},
      ],
    }, {layout: 'right'}),
  );
}
