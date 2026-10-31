import {chevron, diagram, tree} from 'svg-diagram';

// 木のノードに band を使う: 段ごとの矢羽根の帯を木でつなぎ、全体の中の「いまどこ」を見せる。
// ノードは `{label, band, w}`（label は名前、w は帯の幅）。線は帯の辺につながり、帯の中の id も connect() の端点になる。
export default function define() {
  return diagram({theme: 'blue', width: 940, title: '仕事の全体図（段階 → 業務、架空の例）'}).add(
    tree({
      label: '段階', id: 'stage', w: 900, band: chevron([
        {label: '受注', id: 's1'}, {label: '製造', id: 's2', tone: 'accent'}, {label: '出荷', id: 's3'}, {label: '請求', id: 's4'},
      ]),
      children: [
        {label: '製造の業務', id: 'mfg', w: 560, band: chevron([{label: '段取り'}, {label: '加工', tone: 'accent'}, {label: '検査'}, {label: '梱包'}])},
      ],
    }, {dir: 'down', id: 'zoom'}),
  );
}
