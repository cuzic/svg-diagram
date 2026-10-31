import {chevron, diagram, tree} from 'svg-diagram';

// 木のノードの線を、親の band の中の「いま選んでいる段」から出す(漏斗): 子のノードに `from: 親の band の中の id`。
// 段の下辺の両端から、子の帯の上辺の両端へ線が開く。`edges: false` にすると、木の線を引かない（connect() を自分で引く）。
export default function define() {
  return diagram({theme: 'blue', width: 940, title: '仕事の全体図（段階 → 業務 → 手順、架空の例）'}).add(
    tree({
      label: '段階', w: 900, band: chevron([
        {label: '受注', id: 's1'}, {label: '製造', id: 's2', tone: 'accent'}, {label: '出荷', id: 's3'}, {label: '請求', id: 's4'},
      ]),
      children: [{
        label: '製造の業務', from: 's2', w: 560, band: chevron([{label: '段取り', id: 'k1'}, {label: '加工', id: 'k2', tone: 'accent'}, {label: '検査', id: 'k3'}, {label: '梱包', id: 'k4'}]),
        children: [{label: '加工の手順', from: 'k2', w: 300, band: chevron([{label: '切断'}, {label: '研磨'}, {label: '洗浄'}])}],
      }],
    }, {dir: 'down'}),
  );
}
