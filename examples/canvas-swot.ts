import {canvas, diagram} from 'svg-diagram';

// SWOT 分析: 内部環境（強み・弱み）と外部環境（機会・脅威）の 2 × 2。各領域の上端のタグが「内部／外部・プラス／マイナス」を言葉で示す。
export default function define() {
  return diagram({theme: 'blue', title: '地方の老舗書店の SWOT 分析', sourceLine: '出典: 説明用の例'}).add(
    canvas('swot', {
      strengths: ['地域の学校・図書館との取引', '目利きのいる選書', '駅前の立地'],
      weaknesses: ['在庫の管理が人頼み', 'ネット販売の経験が浅い', '店員の高齢化'],
      opportunities: ['地域の読書イベントの需要', '学校の探究学習で資料が要る', '古本の買い取り市場'],
      threats: ['大手ネット書店の値引き', '電子書籍の普及', '再開発による賃料の上昇'],
    }, {title: '現状分析', stamp: '架空の例'}),
  );
}
