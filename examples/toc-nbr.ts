import {causeTree, diagram} from 'svg-diagram';

// ネガティブブランチ(NBR): 施策が悪い結果(UDE)を招く道と、その「転換点」(複数の条件が揃って越える節)、転換点を断つトリミングの施策。
// `tipping` は二重枠の危険色、`trim` は破線の枠。`foldsInto` は、トリミングを元の施策へ組み込む印を箱の下に 1 行で書く(組み込み先が図に無くてもよい)。
// `tree: 'nbr'` を書くと、`tocCheck: 'strict'` で、転換点の無い枝・転換点が AND でない・トリミングが転換点より後ろを断っている、を検査する。
export default function define() {
  return diagram({theme: 'blue', legend: 'auto', tocCheck: 'strict', title: '週次報告の義務づけのネガティブブランチ', sourceLine: '出典: 説明用の例'}).add(
    causeTree(
      [
        {id: 'inj', label: '全拠点に週次報告を義務づける', role: 'injection'},
        {id: 'load', label: '報告の作成に時間を取られる'},
        {id: 'busy', label: '繁忙期と重なる', role: 'precondition'},
        {id: 'tip', label: '現場の残業が常態になる', role: 'tipping'},
        {id: 'bad', label: '人が辞めて、現場が回らなくなる', role: 'ude'},
        {id: 'cut', label: '報告を月次にして様式を 1 枚にする', role: 'trim', foldsInto: '施策 1'},
      ],
      [
        {from: 'inj', to: 'load'},
        {from: ['load', 'busy'], to: 'tip'},
        {from: 'tip', to: 'bad'},
        {from: 'cut', to: 'tip', kind: 'blocks'},
      ],
      {tree: 'nbr'},
    ),
  );
}
